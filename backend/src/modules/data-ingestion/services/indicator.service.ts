import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface IndicatorRow {
  index: number;
  sma20: number | null;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  ema6: number | null;
  ema20: number | null;
  atr14: number | null;
}

/**
 * Pure computation service for SMA, EMA, ATR indicators.
 * No business logic -- mechanical math only.
 */
@Injectable()
export class IndicatorService {
  private readonly logger = new Logger(IndicatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Pure computation functions (no DB dependency) ──

  computeSMA(values: number[], period: number): (number | null)[] {
    const result: (number | null)[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += values[j];
        }
        result.push(sum / period);
      }
    }
    return result;
  }

  computeEMA(values: number[], period: number): (number | null)[] {
    if (values.length === 0) return [];
    const k = 2 / (period + 1);
    const result: (number | null)[] = [];
    // Use first value as seed for EMA
    result.push(values[0]);
    for (let i = 1; i < values.length; i++) {
      const prev = result[i - 1] as number;
      result.push(values[i] * k + prev * (1 - k));
    }
    return result;
  }

  computeATR14(
    highs: number[],
    lows: number[],
    closes: number[],
  ): (number | null)[] {
    const period = 14;
    if (highs.length < 2) return highs.map(() => null);

    const trueRanges: number[] = [highs[0] - lows[0]];
    for (let i = 1; i < highs.length; i++) {
      const hl = highs[i] - lows[i];
      const hc = Math.abs(highs[i] - closes[i - 1]);
      const lc = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(hl, hc, lc));
    }

    const result: (number | null)[] = [];
    for (let i = 0; i < trueRanges.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) sum += trueRanges[j];
        result.push(sum / period);
      } else {
        const prevAtr = result[i - 1] as number;
        result.push((prevAtr * (period - 1) + trueRanges[i]) / period);
      }
    }
    return result;
  }

  /**
   * Compute all indicators for a given set of OHLCV bars (ordered oldest-first).
   */
  computeAllIndicators(
    closes: number[],
    highs: number[],
    lows: number[],
  ): IndicatorRow[] {
    const sma20 = this.computeSMA(closes, 20);
    const sma50 = this.computeSMA(closes, 50);
    const sma150 = this.computeSMA(closes, 150);
    const sma200 = this.computeSMA(closes, 200);
    const ema6 = this.computeEMA(closes, 6);
    const ema20 = this.computeEMA(closes, 20);
    const atr14 = this.computeATR14(highs, lows, closes);

    return closes.map((_, i) => ({
      index: i,
      sma20: sma20[i],
      sma50: sma50[i],
      sma150: sma150[i],
      sma200: sma200[i],
      ema6: ema6[i],
      ema20: ema20[i],
      atr14: atr14[i],
    }));
  }

  // ── DB methods ──

  /**
   * Fetch bars for a stock, compute indicators, and batch-update StockDaily rows.
   */
  async updateIndicatorsForStock(stockId: string): Promise<number> {
    const bars = await this.prisma.stockDaily.findMany({
      where: { stockId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        close: true,
        high: true,
        low: true,
        sma20: true,
      },
    });

    if (bars.length < 20) return 0;

    const closes = bars.map((b) => Number(b.close));
    const highs = bars.map((b) => Number(b.high));
    const lows = bars.map((b) => Number(b.low));

    const indicators = this.computeAllIndicators(closes, highs, lows);

    // Only update bars that don't already have indicators (optimization for re-runs)
    const updates: { id: string; data: Record<string, number | null> }[] = [];
    for (let i = 0; i < bars.length; i++) {
      const row = indicators[i];
      // Skip if we already have sma20 set (assume all indicators are filled)
      if (bars[i].sma20 !== null) continue;

      // Only update if at least one indicator is non-null
      if (
        row.sma20 !== null ||
        row.ema6 !== null ||
        row.atr14 !== null
      ) {
        updates.push({
          id: bars[i].id,
          data: {
            sma20: row.sma20,
            sma50: row.sma50,
            sma150: row.sma150,
            sma200: row.sma200,
            ema6: row.ema6,
            ema20: row.ema20,
            atr14: row.atr14,
          },
        });
      }
    }

    // Batch update in chunks
    const BATCH_SIZE = 500;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await this.prisma.$transaction(
        batch.map((u) =>
          this.prisma.stockDaily.update({
            where: { id: u.id },
            data: u.data,
          }),
        ),
      );
    }

    return updates.length;
  }

  /**
   * Compute indicators for all stocks that have bars without indicators.
   */
  async computeAllStocks(): Promise<{ processed: number; updated: number }> {
    this.logger.log('Computing indicators for all stocks...');

    // Find stocks that have at least one bar without sma20 set
    const stocks = await this.prisma.stock.findMany({
      where: {
        isActive: true,
        dailyBars: { some: { sma20: null } },
      },
      select: { id: true, ticker: true },
    });

    this.logger.log(`${stocks.length} stocks need indicator computation`);

    let totalUpdated = 0;
    for (let i = 0; i < stocks.length; i++) {
      try {
        const updated = await this.updateIndicatorsForStock(stocks[i].id);
        totalUpdated += updated;

        if ((i + 1) % 100 === 0) {
          this.logger.log(
            `Indicators: ${i + 1}/${stocks.length} stocks processed (${totalUpdated} bars updated)`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed indicator computation for ${stocks[i].ticker}`,
          err,
        );
      }
    }

    this.logger.log(
      `Indicator computation complete: ${stocks.length} stocks, ${totalUpdated} bars updated`,
    );
    return { processed: stocks.length, updated: totalUpdated };
  }
}
