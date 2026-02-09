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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let StockService = class StockService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(params) {
        const page = params.page ?? 1;
        const limit = params.limit ?? 50;
        const skip = (page - 1) * limit;
        const where = params.search
            ? {
                OR: [
                    { ticker: { contains: params.search, mode: 'insensitive' } },
                    { name: { contains: params.search, mode: 'insensitive' } },
                ],
            }
            : {};
        const [items, total] = await Promise.all([
            this.prisma.stock.findMany({
                where,
                skip,
                take: limit,
                orderBy: { ticker: 'asc' },
            }),
            this.prisma.stock.count({ where }),
        ]);
        return { items, total, page, limit };
    }
    async findByTicker(ticker) {
        const stock = await this.prisma.stock.findUnique({
            where: { ticker: ticker.toUpperCase() },
            include: {
                stages: { orderBy: { date: 'desc' }, take: 1 },
            },
        });
        if (!stock)
            throw new common_1.NotFoundException(`Stock ${ticker} not found`);
        return stock;
    }
    async getDailyBars(ticker, limit = 252) {
        const stock = await this.findByTicker(ticker);
        return this.prisma.stockDaily.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
            take: limit,
        });
    }
    async getIntradayBars(ticker) {
        const stock = await this.findByTicker(ticker);
        return this.prisma.stockIntraday.findMany({
            where: { stockId: stock.id },
            orderBy: { timestamp: 'asc' },
        });
    }
    async getStageHistory(ticker) {
        const stock = await this.findByTicker(ticker);
        return this.prisma.stockStage.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
        });
    }
    async findLeaders(params) {
        const minGain = params.minGain ?? 50;
        const daysBack = params.days ?? 365;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        const stage2Entries = await this.prisma.stockStage.findMany({
            where: {
                stage: 'STAGE_2',
                date: { gte: cutoffDate },
            },
            include: {
                stock: {
                    include: {
                        themeStocks: {
                            include: {
                                group: {
                                    include: { theme: { select: { name: true } } },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { date: 'asc' },
            distinct: ['stockId'],
        });
        const leaders = [];
        for (const entry of stage2Entries) {
            const [entryBar, peakBar] = await Promise.all([
                this.prisma.stockDaily.findFirst({
                    where: {
                        stockId: entry.stockId,
                        date: { gte: entry.date },
                    },
                    orderBy: { date: 'asc' },
                }),
                this.prisma.stockDaily.findFirst({
                    where: {
                        stockId: entry.stockId,
                        date: { gte: entry.date },
                    },
                    orderBy: { high: 'desc' },
                }),
            ]);
            if (!entryBar || !peakBar)
                continue;
            const entryPrice = Number(entryBar.close);
            const peakPrice = Number(peakBar.high);
            const peakGain = ((peakPrice - entryPrice) / entryPrice) * 100;
            if (peakGain < minGain)
                continue;
            const entryDate = entryBar.date;
            const peakDate = peakBar.date;
            const duration = Math.round((peakDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
            const themeName = entry.stock.themeStocks?.[0]?.group?.theme?.name ?? null;
            leaders.push({
                ticker: entry.stock.ticker,
                name: entry.stock.name,
                peakGain: Math.round(peakGain * 10) / 10,
                duration,
                theme: themeName,
                entryDate: entryDate.toISOString(),
                peakDate: peakDate.toISOString(),
                entryPrice,
                peakPrice,
                stage: entry.stage,
            });
        }
        leaders.sort((a, b) => b.peakGain - a.peakGain);
        return leaders;
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockService);
//# sourceMappingURL=stock.service.js.map