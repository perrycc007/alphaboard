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
exports.ScreeningService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let ScreeningService = class ScreeningService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async screen(filter) {
        const page = filter.page ?? 1;
        const limit = filter.limit ?? 50;
        const stages = await this.prisma.stockStage.findMany({
            where: {
                ...(filter.stage && { stage: filter.stage }),
                ...(filter.category && { category: filter.category }),
                ...(filter.isTemplate !== undefined && {
                    isTemplate: filter.isTemplate,
                }),
            },
            orderBy: { date: 'desc' },
            distinct: ['stockId'],
            include: {
                stock: {
                    include: {
                        dailyBars: {
                            orderBy: { date: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });
        let results = stages.map((s) => ({
            stock: s.stock,
            stage: s.stage,
            category: s.category,
            isTemplate: s.isTemplate,
            latestBar: s.stock.dailyBars[0] ?? null,
        }));
        if (filter.minRsRank !== undefined) {
            results = results.filter((r) => {
                const rs = r.latestBar?.rsRank;
                return rs != null && Number(rs) >= filter.minRsRank;
            });
        }
        if (filter.sector) {
            results = results.filter((r) => r.stock.sector === filter.sector);
        }
        const total = results.length;
        const skip = (page - 1) * limit;
        const items = results.slice(skip, skip + limit);
        return { items, total, page, limit };
    }
};
exports.ScreeningService = ScreeningService;
exports.ScreeningService = ScreeningService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScreeningService);
//# sourceMappingURL=screening.service.js.map