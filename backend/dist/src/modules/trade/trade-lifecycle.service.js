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
exports.TradeLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
let TradeLifecycleService = class TradeLifecycleService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createIdea(data) {
        const riskReward = data.targetPrice && data.entryPrice
            ? (data.targetPrice - data.entryPrice) /
                (data.entryPrice - data.stopPrice)
            : undefined;
        return this.prisma.tradeIdea.create({
            data: {
                userId: data.userId,
                setupId: data.setupId,
                stockId: data.stockId,
                direction: data.direction,
                bias: data.bias,
                entryPrice: data.entryPrice,
                stopPrice: data.stopPrice,
                targetPrice: data.targetPrice,
                riskPercent: data.riskPercent,
                riskReward,
                notes: data.notes,
            },
        });
    }
    async listIdeas(userId) {
        return this.prisma.tradeIdea.findMany({
            where: userId ? { userId } : {},
            orderBy: { createdAt: 'desc' },
            include: { setup: true },
        });
    }
    async confirmIdea(ideaId) {
        const idea = await this.prisma.tradeIdea.findUniqueOrThrow({
            where: { id: ideaId },
        });
        if (idea.status !== client_1.TradeIdeaStatus.PENDING) {
            throw new common_1.NotFoundException('Idea is not in PENDING state');
        }
        const [updatedIdea, intent] = await this.prisma.$transaction([
            this.prisma.tradeIdea.update({
                where: { id: ideaId },
                data: { status: client_1.TradeIdeaStatus.CONFIRMED },
            }),
            this.prisma.tradeIntent.create({
                data: { tradeIdeaId: ideaId },
            }),
        ]);
        return { idea: updatedIdea, intent };
    }
    async skipIdea(ideaId) {
        return this.prisma.tradeIdea.update({
            where: { id: ideaId },
            data: { status: client_1.TradeIdeaStatus.SKIPPED },
        });
    }
    async placeOrder(intentId, data) {
        return this.prisma.order.create({
            data: {
                intentId,
                type: data.type,
                side: data.side,
                quantity: data.quantity,
                limitPrice: data.limitPrice,
                stopPrice: data.stopPrice,
            },
        });
    }
    async listPositions(userId) {
        return this.prisma.position.findMany({
            where: {
                status: 'OPEN',
                ...(userId && { userId }),
            },
            include: { executions: true },
            orderBy: { openedAt: 'desc' },
        });
    }
    async updateStop(positionId, newStop) {
        return this.prisma.position.update({
            where: { id: positionId },
            data: { currentStop: newStop },
        });
    }
    async closePosition(positionId) {
        return this.prisma.position.update({
            where: { id: positionId },
            data: { status: 'CLOSED', closedAt: new Date() },
        });
    }
};
exports.TradeLifecycleService = TradeLifecycleService;
exports.TradeLifecycleService = TradeLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TradeLifecycleService);
//# sourceMappingURL=trade-lifecycle.service.js.map