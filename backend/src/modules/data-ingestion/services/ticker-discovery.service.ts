import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface SecEdgarTicker {
  cik_str: number;
  ticker: string;
  title: string;
}

interface ParsedTicker {
  ticker: string;
  name: string;
  exchange?: string;
}

/**
 * Discovers all US common stock tickers from SEC EDGAR + NASDAQ/NYSE exchange files.
 * Filters out ETFs, ADRs, warrants, units, preferred shares.
 * Uperts to Stock table, preserving existing isCurated flags.
 */
@Injectable()
export class TickerDiscoveryService {
  private readonly logger = new Logger(TickerDiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main entry: runs discovery if Stock table is sparse (< 1000 rows).
   */
  async discoverTickers(): Promise<number> {
    const currentCount = await this.prisma.stock.count();
    if (currentCount >= 1000) {
      this.logger.log(
        `Stock table already has ${currentCount} rows, skipping ticker discovery`,
      );
      return currentCount;
    }

    this.logger.log(
      `Stock table has ${currentCount} rows, starting ticker discovery...`,
    );

    const [secTickers, nasdaqTickers, nyseTickers] = await Promise.allSettled([
      this.fetchSecEdgar(),
      this.fetchNasdaqListings(),
      this.fetchNyseListings(),
    ]);

    const tickerMap = new Map<string, ParsedTicker>();

    // Merge SEC EDGAR tickers
    if (secTickers.status === 'fulfilled') {
      for (const t of secTickers.value) {
        if (!tickerMap.has(t.ticker)) {
          tickerMap.set(t.ticker, t);
        }
      }
      this.logger.log(`SEC EDGAR: ${secTickers.value.length} tickers`);
    } else {
      this.logger.error('SEC EDGAR fetch failed', secTickers.reason);
    }

    // Merge NASDAQ tickers
    if (nasdaqTickers.status === 'fulfilled') {
      for (const t of nasdaqTickers.value) {
        if (!tickerMap.has(t.ticker)) {
          tickerMap.set(t.ticker, t);
        } else {
          // Enrich with exchange info
          const existing = tickerMap.get(t.ticker)!;
          if (!existing.exchange && t.exchange) {
            existing.exchange = t.exchange;
          }
        }
      }
      this.logger.log(`NASDAQ: ${nasdaqTickers.value.length} tickers`);
    } else {
      this.logger.error('NASDAQ fetch failed', nasdaqTickers.reason);
    }

    // Merge NYSE tickers
    if (nyseTickers.status === 'fulfilled') {
      for (const t of nyseTickers.value) {
        if (!tickerMap.has(t.ticker)) {
          tickerMap.set(t.ticker, t);
        } else {
          const existing = tickerMap.get(t.ticker)!;
          if (!existing.exchange && t.exchange) {
            existing.exchange = t.exchange;
          }
        }
      }
      this.logger.log(`NYSE: ${nyseTickers.value.length} tickers`);
    } else {
      this.logger.error('NYSE fetch failed', nyseTickers.reason);
    }

    // Filter: keep only valid common stock tickers
    const filtered = Array.from(tickerMap.values()).filter((t) =>
      this.isCommonStock(t.ticker),
    );

    this.logger.log(
      `After filtering: ${filtered.length} common stock tickers (from ${tickerMap.size} total)`,
    );

    // Batch upsert to Stock table
    let upserted = 0;
    const BATCH_SIZE = 100;
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((t) =>
          this.prisma.stock.upsert({
            where: { ticker: t.ticker },
            create: {
              ticker: t.ticker,
              name: t.name,
              exchange: t.exchange,
            },
            update: {
              // Only update exchange if we have new info -- don't overwrite name/sector for curated stocks
              ...(t.exchange ? { exchange: t.exchange } : {}),
            },
          }),
        ),
      );
      upserted += results.filter((r) => r.status === 'fulfilled').length;

      if ((i / BATCH_SIZE) % 10 === 0) {
        this.logger.log(
          `Upserted ${upserted}/${filtered.length} tickers...`,
        );
      }
    }

    this.logger.log(`Ticker discovery complete: ${upserted} stocks in DB`);
    return upserted;
  }

  private async fetchSecEdgar(): Promise<ParsedTicker[]> {
    const url = 'https://www.sec.gov/files/company_tickers.json';
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Alphaboard/1.0 (alphaboard@example.com)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`SEC EDGAR HTTP ${res.status}`);

    const data = (await res.json()) as Record<string, SecEdgarTicker>;
    return Object.values(data).map((entry) => ({
      ticker: entry.ticker.toUpperCase().replace(/\//g, '.'),
      name: this.titleCase(entry.title),
    }));
  }

  private async fetchNasdaqListings(): Promise<ParsedTicker[]> {
    const url =
      'https://raw.githubusercontent.com/datasets/nasdaq-listings/main/data/nasdaq-listed.csv';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NASDAQ CSV HTTP ${res.status}`);

    const text = await res.text();
    return this.parseCsv(text, 'NASDAQ');
  }

  private async fetchNyseListings(): Promise<ParsedTicker[]> {
    const url =
      'https://raw.githubusercontent.com/datasets/nyse-other-listings/main/data/nyse-listed.csv';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NYSE CSV HTTP ${res.status}`);

    const text = await res.text();
    return this.parseCsv(text, 'NYSE');
  }

  private parseCsv(text: string, exchange: string): ParsedTicker[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const symbolIdx = header.findIndex(
      (h) =>
        h === 'symbol' ||
        h === 'act symbol' ||
        h === 'actsymbol' ||
        h === 'ticker',
    );
    const nameIdx = header.findIndex(
      (h) =>
        h === 'company name' ||
        h === 'companyname' ||
        h === 'security name' ||
        h === 'securityname' ||
        h === 'name',
    );

    if (symbolIdx === -1) return [];

    const tickers: ParsedTicker[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));
      const ticker = cols[symbolIdx]?.toUpperCase();
      const name = cols[nameIdx] || ticker;

      if (ticker && ticker.length > 0 && ticker.length <= 5) {
        tickers.push({ ticker, name, exchange });
      }
    }
    return tickers;
  }

  /**
   * Filter: keep only common stocks. Exclude ETFs, warrants, units, preferred, test symbols.
   */
  private isCommonStock(ticker: string): boolean {
    // Must be 1-5 uppercase letters (no digits in ticker for common stocks, but some do exist like V)
    if (!/^[A-Z]{1,5}$/.test(ticker)) return false;

    // Exclude known ETF tickers (simple heuristic -- not perfect but catches most)
    const etfExclusions = new Set([
      'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'IVV', 'VEA', 'VWO',
      'EEM', 'AGG', 'BND', 'TLT', 'GLD', 'SLV', 'USO', 'XLF', 'XLK',
      'XLE', 'XLV', 'XLI', 'XLU', 'XLP', 'XLY', 'XLB', 'XLRE', 'XLC',
      'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'SOXL', 'TQQQ', 'SQQQ',
      'SPXL', 'SPXS', 'UVXY', 'VXX', 'VIXY', 'HYG', 'LQD', 'JNK',
      'IEF', 'SHY', 'TIP', 'IEFA', 'EFA', 'SCHD', 'VIG', 'DVY',
    ]);
    if (etfExclusions.has(ticker)) return false;

    return true;
  }

  private titleCase(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
}
