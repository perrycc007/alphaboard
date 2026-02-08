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
exports.ThemeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ThemeService = class ThemeService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        const themes = await this.prisma.theme.findMany({
            where: { isActive: true },
            include: {
                groups: {
                    include: {
                        themeStocks: {
                            include: {
                                stock: {
                                    include: {
                                        stages: { orderBy: { date: 'desc' }, take: 1 },
                                        setups: { where: { state: { in: ['BUILDING', 'READY', 'TRIGGERED'] } } },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        return themes.map((theme) => {
            const allStocks = theme.groups.flatMap((g) => g.themeStocks);
            const stages = allStocks
                .map((ts) => ts.stock.stages[0])
                .filter(Boolean);
            const setups = allStocks.flatMap((ts) => ts.stock.setups);
            const hotCount = stages.filter((s) => s.category === 'HOT').length;
            const formerHotCount = stages.filter((s) => s.category === 'FORMER_HOT').length;
            const setupCount = setups.length;
            const bullishSetups = setups.filter((s) => s.direction === 'LONG').length;
            const bearishSetups = setups.filter((s) => s.direction === 'SHORT').length;
            const total = stages.length || 1;
            const stageDistribution = {
                stage1: stages.filter((s) => s.stage === 'STAGE_1').length / total,
                stage2: stages.filter((s) => s.stage === 'STAGE_2').length / total,
                stage3: stages.filter((s) => s.stage === 'STAGE_3').length / total,
                stage4: stages.filter((s) => s.stage === 'STAGE_4').length / total,
            };
            return {
                id: theme.id,
                name: theme.name,
                description: theme.description,
                stats: {
                    hotCount,
                    formerHotCount,
                    setupCount,
                    bullishPct: setupCount > 0
                        ? Math.round((bullishSetups / setupCount) * 100)
                        : 0,
                    bearishPct: setupCount > 0
                        ? Math.round((bearishSetups / setupCount) * 100)
                        : 0,
                    stageDistribution,
                },
            };
        });
    }
    async findById(id) {
        const theme = await this.prisma.theme.findUnique({
            where: { id },
            include: {
                groups: {
                    include: {
                        themeStocks: {
                            include: {
                                stock: {
                                    include: {
                                        stages: { orderBy: { date: 'desc' }, take: 1 },
                                        dailyBars: { orderBy: { date: 'desc' }, take: 1 },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });
        if (!theme)
            throw new common_1.NotFoundException(`Theme ${id} not found`);
        return theme;
    }
    async create(data) {
        return this.prisma.theme.create({ data });
    }
    async update(id, data) {
        return this.prisma.theme.update({ where: { id }, data });
    }
    async addStockToGroup(groupId, stockId) {
        return this.prisma.themeStock.create({
            data: { groupId, stockId },
        });
    }
};
exports.ThemeService = ThemeService;
exports.ThemeService = ThemeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ThemeService);
//# sourceMappingURL=theme.service.js.map