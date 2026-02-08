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
exports.AlertService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const alert_gateway_1 = require("./alert.gateway");
let AlertService = class AlertService {
    prisma;
    alertGateway;
    constructor(prisma, alertGateway) {
        this.prisma = prisma;
        this.alertGateway = alertGateway;
    }
    async findByUser(userId) {
        return this.prisma.alert.findMany({
            where: { userId },
            include: { stock: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(data) {
        return this.prisma.alert.create({
            data: {
                userId: data.userId,
                stockId: data.stockId,
                type: data.type,
                condition: data.condition,
            },
        });
    }
    async remove(id) {
        return this.prisma.alert.delete({ where: { id } });
    }
    async triggerAlert(alertId, payload) {
        const alert = await this.prisma.alert.update({
            where: { id: alertId },
            data: { isTriggered: true, triggeredAt: new Date() },
            include: { stock: true },
        });
        this.alertGateway.sendAlert(alert.userId, {
            alertId: alert.id,
            type: alert.type,
            ticker: alert.stock?.ticker,
            payload,
            triggeredAt: alert.triggeredAt,
        });
        return alert;
    }
};
exports.AlertService = AlertService;
exports.AlertService = AlertService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        alert_gateway_1.AlertGateway])
], AlertService);
//# sourceMappingURL=alert.service.js.map