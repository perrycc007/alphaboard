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
var BreadthSyncJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadthSyncJob = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../../prisma/prisma.service");
let BreadthSyncJob = BreadthSyncJob_1 = class BreadthSyncJob {
    prisma;
    logger = new common_1.Logger(BreadthSyncJob_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async run() {
        this.logger.log('Starting breadth computation...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const stocks = await this.prisma.stock.findMany({
            where: { isActive: true },
            select: { id: true },
        });
        let advancing = 0;
        let declining = 0;
        let above50 = 0;
        let above200 = 0;
        let newHighs = 0;
        let newLows = 0;
        let totalWithData = 0;
        for (const stock of stocks) {
            try {
                const recentBars = await this.prisma.stockDaily.findMany({
                    where: { stockId: stock.id },
                    orderBy: { date: 'desc' },
                    take: 2,
                    select: { close: true, sma50: true, sma200: true, high: true, low: true },
                });
                if (recentBars.length < 2)
                    continue;
                totalWithData++;
                const todayBar = recentBars[0];
                const yesterdayBar = recentBars[1];
                const todayClose = Number(todayBar.close);
                const yesterdayClose = Number(yesterdayBar.close);
                if (todayClose > yesterdayClose)
                    advancing++;
                else if (todayClose < yesterdayClose)
                    declining++;
                if (todayBar.sma50 !== null && todayClose > Number(todayBar.sma50)) {
                    above50++;
                }
                if (todayBar.sma200 !== null && todayClose > Number(todayBar.sma200)) {
                    above200++;
                }
                const oneYearAgo = new Date(today);
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const yearExtremes = await this.prisma.stockDaily.aggregate({
                    where: {
                        stockId: stock.id,
                        date: { gte: oneYearAgo },
                    },
                    _max: { high: true },
                    _min: { low: true },
                });
                if (yearExtremes._max.high !== null) {
                    const yearHigh = Number(yearExtremes._max.high);
                    const yearLow = Number(yearExtremes._min.low);
                    const currentHigh = Number(todayBar.high);
                    const currentLow = Number(todayBar.low);
                    if (currentHigh >= yearHigh * 0.99)
                        newHighs++;
                    if (currentLow <= yearLow * 1.01)
                        newLows++;
                }
            }
            catch {
            }
        }
        const naad = advancing - declining;
        const naa50r = totalWithData > 0 ? (above50 / totalWithData) * 100 : 0;
        const naa200r = totalWithData > 0 ? (above200 / totalWithData) * 100 : 0;
        const nahl = newHighs - newLows;
        await this.prisma.breadthSnapshot.upsert({
            where: { date: today },
            create: {
                date: today,
                naad,
                naa50r,
                naa200r,
                nahl,
            },
            update: {
                naad,
                naa50r,
                naa200r,
                nahl,
            },
        });
        this.logger.log(`Breadth computed: NAAD=${naad}, NAA50R=${naa50r.toFixed(1)}%, NAA200R=${naa200r.toFixed(1)}%, NAHL=${nahl} (${totalWithData} stocks analyzed)`);
    }
};
exports.BreadthSyncJob = BreadthSyncJob;
__decorate([
    (0, schedule_1.Cron)('15 17 * * 1-5'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BreadthSyncJob.prototype, "run", null);
exports.BreadthSyncJob = BreadthSyncJob = BreadthSyncJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BreadthSyncJob);
//# sourceMappingURL=breadth-sync.job.js.map