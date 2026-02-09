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
var RsRankService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsRankService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let RsRankService = RsRankService_1 = class RsRankService {
    prisma;
    logger = new common_1.Logger(RsRankService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async computeRanks() {
        this.logger.log('Computing RS Ranks...');
        const stocks = await this.prisma.stock.findMany({
            where: { isActive: true },
            select: { id: true, ticker: true },
        });
        const rsDataList = [];
        for (const stock of stocks) {
            try {
                const bars = await this.prisma.stockDaily.findMany({
                    where: { stockId: stock.id },
                    orderBy: { date: 'desc' },
                    take: 252,
                    select: { id: true, close: true },
                });
                if (bars.length < 20)
                    continue;
                const closes = bars.map((b) => Number(b.close)).reverse();
                const rsRaw = this.computeRsRaw(closes);
                if (rsRaw === null)
                    continue;
                rsDataList.push({
                    stockId: stock.id,
                    ticker: stock.ticker,
                    latestBarId: bars[0].id,
                    rsRaw,
                });
            }
            catch {
            }
        }
        if (rsDataList.length === 0) {
            this.logger.log('No stocks with enough data for RS Rank');
            return 0;
        }
        rsDataList.sort((a, b) => a.rsRaw - b.rsRaw);
        const total = rsDataList.length;
        const updates = [];
        for (let i = 0; i < total; i++) {
            const percentile = Math.max(1, Math.min(99, Math.round(((i + 1) / total) * 99)));
            updates.push({ barId: rsDataList[i].latestBarId, rank: percentile });
        }
        const BATCH_SIZE = 500;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE);
            await this.prisma.$transaction(batch.map((u) => this.prisma.stockDaily.update({
                where: { id: u.barId },
                data: { rsRank: u.rank },
            })));
        }
        this.logger.log(`RS Rank computed for ${updates.length} stocks (percentile 1-99)`);
        return updates.length;
    }
    computeRsRaw(closes) {
        const n = closes.length;
        if (n < 20)
            return null;
        const latest = closes[n - 1];
        const quarters = [];
        if (n >= 63) {
            quarters.push({
                start: n - 63,
                end: n - 1,
                weight: 2,
            });
        }
        if (n >= 126) {
            quarters.push({
                start: n - 126,
                end: n - 64,
                weight: 1,
            });
        }
        if (n >= 189) {
            quarters.push({
                start: n - 189,
                end: n - 127,
                weight: 1,
            });
        }
        if (n >= 252) {
            quarters.push({
                start: n - 252,
                end: n - 190,
                weight: 1,
            });
        }
        if (quarters.length === 0) {
            const change = (latest / closes[0] - 1) * 100;
            return change * 5;
        }
        const quarterChanges = [];
        for (const q of quarters) {
            const startPrice = closes[q.start];
            if (startPrice <= 0)
                continue;
            const endPrice = closes[q.end];
            const change = ((endPrice / startPrice) - 1) * 100;
            quarterChanges.push({ change, weight: q.weight });
        }
        if (quarterChanges.length === 0)
            return null;
        const totalOriginalWeight = quarterChanges.reduce((sum, q) => sum + q.weight, 0);
        const weightMultiplier = 5 / totalOriginalWeight;
        let rsRaw = 0;
        for (const q of quarterChanges) {
            rsRaw += q.change * q.weight * weightMultiplier;
        }
        return rsRaw;
    }
};
exports.RsRankService = RsRankService;
exports.RsRankService = RsRankService = RsRankService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RsRankService);
//# sourceMappingURL=rs-rank.service.js.map