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
var DailySyncJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailySyncJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
const yfinance_provider_1 = require("../providers/yfinance.provider");
let DailySyncJob = DailySyncJob_1 = class DailySyncJob {
    prisma;
    yfinance;
    logger = new common_1.Logger(DailySyncJob_1.name);
    constructor(prisma, yfinance) {
        this.prisma = prisma;
        this.yfinance = yfinance;
    }
    async run() {
        this.logger.log('Starting daily sync...');
        const stocks = await this.prisma.stock.findMany({
            where: { isActive: true },
            select: { id: true, ticker: true },
        });
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 5);
        for (const stock of stocks) {
            try {
                const bars = await this.yfinance.fetchDailyBars(stock.ticker, from, today);
                for (const bar of bars) {
                    await this.prisma.stockDaily.upsert({
                        where: {
                            stockId_date: { stockId: stock.id, date: bar.date },
                        },
                        create: {
                            stockId: stock.id,
                            date: bar.date,
                            open: bar.open,
                            high: bar.high,
                            low: bar.low,
                            close: bar.close,
                            volume: BigInt(Math.round(bar.volume)),
                        },
                        update: {
                            open: bar.open,
                            high: bar.high,
                            low: bar.low,
                            close: bar.close,
                            volume: BigInt(Math.round(bar.volume)),
                        },
                    });
                }
            }
            catch (err) {
                this.logger.error(`Failed to sync ${stock.ticker}`, err);
            }
        }
        const indices = await this.prisma.indexEntity.findMany();
        for (const index of indices) {
            try {
                const bars = await this.yfinance.fetchDailyBars(index.ticker, from, today);
                for (const bar of bars) {
                    await this.prisma.indexDaily.upsert({
                        where: {
                            indexId_date: { indexId: index.id, date: bar.date },
                        },
                        create: {
                            indexId: index.id,
                            date: bar.date,
                            open: bar.open,
                            high: bar.high,
                            low: bar.low,
                            close: bar.close,
                            volume: BigInt(Math.round(bar.volume)),
                        },
                        update: {
                            open: bar.open,
                            high: bar.high,
                            low: bar.low,
                            close: bar.close,
                            volume: BigInt(Math.round(bar.volume)),
                        },
                    });
                }
            }
            catch (err) {
                this.logger.error(`Failed to sync index ${index.ticker}`, err);
            }
        }
        this.logger.log('Daily sync complete');
    }
};
exports.DailySyncJob = DailySyncJob;
__decorate([
    (0, schedule_1.Cron)('0 17 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DailySyncJob.prototype, "run", null);
exports.DailySyncJob = DailySyncJob = DailySyncJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        yfinance_provider_1.YFinanceProvider])
], DailySyncJob);
//# sourceMappingURL=daily-sync.job.js.map