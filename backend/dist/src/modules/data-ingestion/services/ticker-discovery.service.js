"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TickerDiscoveryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TickerDiscoveryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let TickerDiscoveryService = TickerDiscoveryService_1 = class TickerDiscoveryService {
    prisma;
    logger = new common_1.Logger(TickerDiscoveryService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async discoverTickers() {
        const currentCount = await this.prisma.stock.count();
        if (currentCount >= 1000) {
            this.logger.log(`Stock table already has ${currentCount} rows, skipping ticker discovery`);
            return currentCount;
        }
        this.logger.log(`Stock table has ${currentCount} rows, starting ticker discovery...`);
        const [secTickers, nasdaqTickers, nyseTickers] = await Promise.allSettled([
            this.fetchSecEdgar(),
            this.fetchNasdaqListings(),
            this.fetchNyseListings(),
        ]);
        const tickerMap = new Map();
        if (secTickers.status === 'fulfilled') {
            for (const t of secTickers.value) {
                if (!tickerMap.has(t.ticker)) {
                    tickerMap.set(t.ticker, t);
                }
            }
            this.logger.log(`SEC EDGAR: ${secTickers.value.length} tickers`);
        }
        else {
            this.logger.error('SEC EDGAR fetch failed', secTickers.reason);
        }
        if (nasdaqTickers.status === 'fulfilled') {
            for (const t of nasdaqTickers.value) {
                if (!tickerMap.has(t.ticker)) {
                    tickerMap.set(t.ticker, t);
                }
                else {
                    const existing = tickerMap.get(t.ticker);
                    if (!existing.exchange && t.exchange) {
                        existing.exchange = t.exchange;
                    }
                }
            }
            this.logger.log(`NASDAQ: ${nasdaqTickers.value.length} tickers`);
        }
        else {
            this.logger.error('NASDAQ fetch failed', nasdaqTickers.reason);
        }
        if (nyseTickers.status === 'fulfilled') {
            for (const t of nyseTickers.value) {
                if (!tickerMap.has(t.ticker)) {
                    tickerMap.set(t.ticker, t);
                }
                else {
                    const existing = tickerMap.get(t.ticker);
                    if (!existing.exchange && t.exchange) {
                        existing.exchange = t.exchange;
                    }
                }
            }
            this.logger.log(`NYSE: ${nyseTickers.value.length} tickers`);
        }
        else {
            this.logger.error('NYSE fetch failed', nyseTickers.reason);
        }
        const filtered = Array.from(tickerMap.values()).filter((t) => this.isCommonStock(t.ticker));
        this.logger.log(`After filtering: ${filtered.length} common stock tickers (from ${tickerMap.size} total)`);
        let upserted = 0;
        const BATCH_SIZE = 100;
        for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
            const batch = filtered.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(batch.map((t) => this.prisma.stock.upsert({
                where: { ticker: t.ticker },
                create: {
                    ticker: t.ticker,
                    name: t.name,
                    exchange: t.exchange,
                },
                update: {
                    ...(t.exchange ? { exchange: t.exchange } : {}),
                },
            })));
            upserted += results.filter((r) => r.status === 'fulfilled').length;
            if ((i / BATCH_SIZE) % 10 === 0) {
                this.logger.log(`Upserted ${upserted}/${filtered.length} tickers...`);
            }
        }
        this.logger.log(`Ticker discovery complete: ${upserted} stocks in DB`);
        return upserted;
    }
    async fetchSecEdgar() {
        const url = 'https://www.sec.gov/files/company_tickers.json';
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Alphaboard/1.0 (alphaboard@example.com)',
                Accept: 'application/json',
            },
        });
        if (!res.ok)
            throw new Error(`SEC EDGAR HTTP ${res.status}`);
        const data = (await res.json());
        return Object.values(data).map((entry) => ({
            ticker: entry.ticker.toUpperCase().replace(/\//g, '.'),
            name: this.titleCase(entry.title),
        }));
    }
    async fetchNasdaqListings() {
        const url = 'https://raw.githubusercontent.com/datasets/nasdaq-listings/main/data/nasdaq-listed.csv';
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`NASDAQ CSV HTTP ${res.status}`);
        const text = await res.text();
        return this.parseCsv(text, 'NASDAQ');
    }
    async fetchNyseListings() {
        const url = 'https://raw.githubusercontent.com/datasets/nyse-other-listings/main/data/nyse-listed.csv';
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`NYSE CSV HTTP ${res.status}`);
        const text = await res.text();
        return this.parseCsv(text, 'NYSE');
    }
    parseCsv(text, exchange) {
        const lines = text.trim().split('\n');
        if (lines.length < 2)
            return [];
        const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const symbolIdx = header.findIndex((h) => h === 'symbol' ||
            h === 'act symbol' ||
            h === 'actsymbol' ||
            h === 'ticker');
        const nameIdx = header.findIndex((h) => h === 'company name' ||
            h === 'companyname' ||
            h === 'security name' ||
            h === 'securityname' ||
            h === 'name');
        if (symbolIdx === -1)
            return [];
        const tickers = [];
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
    isCommonStock(ticker) {
        if (!/^[A-Z]{1,5}$/.test(ticker))
            return false;
        const etfExclusions = new Set([
            'SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO', 'IVV', 'VEA', 'VWO',
            'EEM', 'AGG', 'BND', 'TLT', 'GLD', 'SLV', 'USO', 'XLF', 'XLK',
            'XLE', 'XLV', 'XLI', 'XLU', 'XLP', 'XLY', 'XLB', 'XLRE', 'XLC',
            'ARKK', 'ARKW', 'ARKG', 'ARKF', 'ARKQ', 'SOXL', 'TQQQ', 'SQQQ',
            'SPXL', 'SPXS', 'UVXY', 'VXX', 'VIXY', 'HYG', 'LQD', 'JNK',
            'IEF', 'SHY', 'TIP', 'IEFA', 'EFA', 'SCHD', 'VIG', 'DVY',
        ]);
        if (etfExclusions.has(ticker))
            return false;
        return true;
    }
    titleCase(str) {
        return str
            .toLowerCase()
            .split(' ')
            .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
            .join(' ');
    }
};
exports.TickerDiscoveryService = TickerDiscoveryService;
exports.TickerDiscoveryService = TickerDiscoveryService = TickerDiscoveryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TickerDiscoveryService);
//# sourceMappingURL=ticker-discovery.service.js.map