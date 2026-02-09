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
var BackfillService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackfillService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const yfinance_provider_1 = require("../providers/yfinance.provider");
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
function getLastTradingDay() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay();
    if (day === 0)
        now.setDate(now.getDate() - 2);
    else if (day === 6)
        now.setDate(now.getDate() - 1);
    return now;
}
let BackfillService = BackfillService_1 = class BackfillService {
    prisma;
    yfinance;
    logger = new common_1.Logger(BackfillService_1.name);
    constructor(prisma, yfinance) {
        this.prisma = prisma;
        this.yfinance = yfinance;
    }
    async getStocksNeedingSync() {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        twoYearsAgo.setHours(0, 0, 0, 0);
        const stocks = await this.prisma.stock.findMany({
            where: { isActive: true },
            select: {
                id: true,
                ticker: true,
                lastSyncDate: true,
                isCurated: true,
            },
        });
        const lastTradingDay = getLastTradingDay();
        return stocks
            .filter((s) => !s.lastSyncDate || s.lastSyncDate < lastTradingDay)
            .map((s) => ({
            stockId: s.id,
            ticker: s.ticker,
            isCurated: s.isCurated,
            from: s.lastSyncDate
                ? addDays(s.lastSyncDate, 1)
                : twoYearsAgo,
        }));
    }
    async backfillAll() {
        const tasks = await this.getStocksNeedingSync();
        if (tasks.length === 0) {
            this.logger.log('All stocks up to date');
            return { synced: 0, failed: 0 };
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const ordered = [
            ...tasks.filter((s) => s.isCurated),
            ...tasks.filter((s) => !s.isCurated),
        ];
        this.logger.log(`Backfilling ${ordered.length} stocks (${tasks.filter((s) => s.isCurated).length} curated first)`);
        let synced = 0;
        let failed = 0;
        const batches = chunk(ordered, 5);
        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            const batch = batches[batchIdx];
            const results = await Promise.allSettled(batch.map((s) => this.syncSingleStock(s, today)));
            for (const r of results) {
                if (r.status === 'fulfilled' && r.value) {
                    synced++;
                }
                else {
                    failed++;
                }
            }
            if ((batchIdx + 1) % 50 === 0) {
                this.logger.log(`Backfill progress: ${synced + failed}/${ordered.length} (${synced} synced, ${failed} failed)`);
            }
            if (batchIdx < batches.length - 1) {
                await delay(500);
            }
        }
        this.logger.log(`Backfill complete: ${synced} synced, ${failed} failed out of ${ordered.length}`);
        return { synced, failed };
    }
    async backfillIndices() {
        this.logger.log('Backfilling index data...');
        const indices = await this.prisma.indexEntity.findMany();
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        twoYearsAgo.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const index of indices) {
            try {
                const latestBar = await this.prisma.indexDaily.findFirst({
                    where: { indexId: index.id },
                    orderBy: { date: 'desc' },
                    select: { date: true },
                });
                const from = latestBar
                    ? addDays(latestBar.date, 1)
                    : twoYearsAgo;
                if (from > today) {
                    this.logger.log(`Index ${index.ticker} already up to date`);
                    continue;
                }
                const bars = await this.yfinance.fetchDailyBars(index.ticker, from, today);
                if (bars.length > 0) {
                    await this.prisma.indexDaily.createMany({
                        data: bars.map((b) => ({
                            indexId: index.id,
                            date: b.date,
                            open: b.open,
                            high: b.high,
                            low: b.low,
                            close: b.close,
                            volume: BigInt(Math.round(b.volume)),
                        })),
                        skipDuplicates: true,
                    });
                    this.logger.log(`Index ${index.ticker}: ${bars.length} bars synced`);
                }
            }
            catch (err) {
                this.logger.error(`Failed to backfill index ${index.ticker}`, err);
            }
        }
        this.logger.log('Index backfill complete');
    }
    async syncSingleStock(task, today) {
        const bars = await this.yfinance.fetchDailyBars(task.ticker, task.from, today);
        if (bars.length === 0) {
            await this.prisma.stock.update({
                where: { id: task.stockId },
                data: { lastSyncDate: today },
            });
            return true;
        }
        await this.prisma.stockDaily.createMany({
            data: bars.map((b) => ({
                stockId: task.stockId,
                date: b.date,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
                volume: BigInt(Math.round(b.volume)),
            })),
            skipDuplicates: true,
        });
        const recentBars = bars.slice(-50);
        const avgVol = recentBars.reduce((sum, b) => sum + b.volume, 0) / recentBars.length;
        await this.prisma.stock.update({
            where: { id: task.stockId },
            data: {
                lastSyncDate: today,
                avgVolume: BigInt(Math.round(avgVol)),
            },
        });
        return true;
    }
};
exports.BackfillService = BackfillService;
exports.BackfillService = BackfillService = BackfillService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        yfinance_provider_1.YFinanceProvider])
], BackfillService);
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
//# sourceMappingURL=backfill.service.js.map