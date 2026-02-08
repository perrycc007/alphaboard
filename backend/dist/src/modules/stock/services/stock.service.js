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
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StockService);
//# sourceMappingURL=stock.service.js.map