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
var IndicatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndicatorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let IndicatorService = IndicatorService_1 = class IndicatorService {
    prisma;
    logger = new common_1.Logger(IndicatorService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    computeSMA(values, period) {
        const result = [];
        for (let i = 0; i < values.length; i++) {
            if (i < period - 1) {
                result.push(null);
            }
            else {
                let sum = 0;
                for (let j = i - period + 1; j <= i; j++) {
                    sum += values[j];
                }
                result.push(sum / period);
            }
        }
        return result;
    }
    computeEMA(values, period) {
        if (values.length === 0)
            return [];
        const k = 2 / (period + 1);
        const result = [];
        result.push(values[0]);
        for (let i = 1; i < values.length; i++) {
            const prev = result[i - 1];
            result.push(values[i] * k + prev * (1 - k));
        }
        return result;
    }
    computeATR14(highs, lows, closes) {
        const period = 14;
        if (highs.length < 2)
            return highs.map(() => null);
        const trueRanges = [highs[0] - lows[0]];
        for (let i = 1; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i - 1]);
            const lc = Math.abs(lows[i] - closes[i - 1]);
            trueRanges.push(Math.max(hl, hc, lc));
        }
        const result = [];
        for (let i = 0; i < trueRanges.length; i++) {
            if (i < period - 1) {
                result.push(null);
            }
            else if (i === period - 1) {
                let sum = 0;
                for (let j = 0; j < period; j++)
                    sum += trueRanges[j];
                result.push(sum / period);
            }
            else {
                const prevAtr = result[i - 1];
                result.push((prevAtr * (period - 1) + trueRanges[i]) / period);
            }
        }
        return result;
    }
    computeAllIndicators(closes, highs, lows) {
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
    async updateIndicatorsForStock(stockId) {
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
        if (bars.length < 20)
            return 0;
        const closes = bars.map((b) => Number(b.close));
        const highs = bars.map((b) => Number(b.high));
        const lows = bars.map((b) => Number(b.low));
        const indicators = this.computeAllIndicators(closes, highs, lows);
        const updates = [];
        for (let i = 0; i < bars.length; i++) {
            const row = indicators[i];
            if (bars[i].sma20 !== null)
                continue;
            if (row.sma20 !== null ||
                row.ema6 !== null ||
                row.atr14 !== null) {
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
        const BATCH_SIZE = 500;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
            const batch = updates.slice(i, i + BATCH_SIZE);
            await this.prisma.$transaction(batch.map((u) => this.prisma.stockDaily.update({
                where: { id: u.id },
                data: u.data,
            })));
        }
        return updates.length;
    }
    async computeAllStocks() {
        this.logger.log('Computing indicators for all stocks...');
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
                    this.logger.log(`Indicators: ${i + 1}/${stocks.length} stocks processed (${totalUpdated} bars updated)`);
                }
            }
            catch (err) {
                this.logger.error(`Failed indicator computation for ${stocks[i].ticker}`, err);
            }
        }
        this.logger.log(`Indicator computation complete: ${stocks.length} stocks, ${totalUpdated} bars updated`);
        return { processed: stocks.length, updated: totalUpdated };
    }
};
exports.IndicatorService = IndicatorService;
exports.IndicatorService = IndicatorService = IndicatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IndicatorService);
//# sourceMappingURL=indicator.service.js.map