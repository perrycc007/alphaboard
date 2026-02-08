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
var MarketService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const breadth_service_1 = require("./breadth.service");
let MarketService = MarketService_1 = class MarketService {
    prisma;
    breadthService;
    logger = new common_1.Logger(MarketService_1.name);
    constructor(prisma, breadthService) {
        this.prisma = prisma;
        this.breadthService = breadthService;
    }
    async getOverview() {
        const [indices, latestBreadth] = await Promise.all([
            this.getIndicesWithLatest(),
            this.breadthService.getLatest(),
        ]);
        return {
            indices,
            breadth: latestBreadth,
            timestamp: new Date().toISOString(),
        };
    }
    async getIndicesWithLatest() {
        const indices = await this.prisma.indexEntity.findMany({
            include: {
                dailyBars: {
                    orderBy: { date: 'desc' },
                    take: 1,
                },
            },
        });
        return indices.map((idx) => ({
            ticker: idx.ticker,
            name: idx.name,
            latest: idx.dailyBars[0] ?? null,
        }));
    }
    async getIndexDaily(ticker, range) {
        const index = await this.prisma.indexEntity.findUniqueOrThrow({
            where: { ticker },
        });
        const dateFilter = range ? this.buildDateFilter(range) : {};
        return this.prisma.indexDaily.findMany({
            where: { indexId: index.id, ...dateFilter },
            orderBy: { date: 'asc' },
        });
    }
    buildDateFilter(range) {
        const days = parseInt(range.replace('d', ''), 10);
        if (isNaN(days))
            return {};
        const since = new Date();
        since.setDate(since.getDate() - days);
        return { date: { gte: since } };
    }
};
exports.MarketService = MarketService;
exports.MarketService = MarketService = MarketService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        breadth_service_1.BreadthService])
], MarketService);
//# sourceMappingURL=market.service.js.map