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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupController = void 0;
const common_1 = require("@nestjs/common");
const nestjs_better_auth_1 = require("@thallesp/nestjs-better-auth");
const setup_orchestrator_service_1 = require("./setup-orchestrator.service");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const file_log_util_1 = require("../../common/utils/file-log.util");
let SetupController = class SetupController {
    orchestrator;
    prisma;
    constructor(orchestrator, prisma) {
        this.orchestrator = orchestrator;
        this.prisma = prisma;
    }
    getActiveSetups(type, direction, timeframe) {
        return this.orchestrator.getActiveSetups({ type, direction, timeframe });
    }
    async triggerScan() {
        return { message: 'Scan triggered' };
    }
    async simulateSetups(ticker, from) {
        const fromDate = from ? new Date(from) : new Date('2008-01-01');
        return this.orchestrator.simulateDetection(ticker, fromDate);
    }
    getSetupById(id) {
        return this.orchestrator.getSetupById(id);
    }
    getSetupEvidence(id) {
        return this.prisma.barEvidence.findMany({
            where: { setupId: id },
            orderBy: { barDate: 'desc' },
        });
    }
    async getSetupFeedback(id) {
        const rows = await (0, file_log_util_1.readJsonLog)('setup-feedback.json');
        return rows
            .filter((row) => row.setupId === id)
            .sort((a, b) => String(b.loggedAt ?? '').localeCompare(String(a.loggedAt ?? '')));
    }
    async addSetupFeedback(id, body) {
        await (0, file_log_util_1.appendJsonLog)('setup-feedback.json', {
            setupId: id,
            rating: body.rating,
            comment: body.comment ?? null,
        });
        return { saved: true };
    }
    async getStockEvidence(ticker, timeframe) {
        const stock = await this.prisma.stock.findUniqueOrThrow({
            where: { ticker: ticker.toUpperCase() },
        });
        return this.prisma.barEvidence.findMany({
            where: {
                stockId: stock.id,
                ...(timeframe && { timeframe }),
            },
            orderBy: { barDate: 'desc' },
            take: 100,
        });
    }
    async getEventLog(source, event, ticker, limit) {
        const max = Math.min(Number(limit) || 100, 500);
        const rows = await (0, file_log_util_1.readJsonLog)('detector-events.json');
        return rows
            .filter((row) => (source ? row.source === source : true))
            .filter((row) => (event ? row.event === event : true))
            .filter((row) => (ticker ? row.ticker === ticker : true))
            .sort((a, b) => String(b.loggedAt ?? '').localeCompare(String(a.loggedAt ?? '')))
            .slice(0, max);
    }
};
exports.SetupController = SetupController;
__decorate([
    (0, common_1.Get)('setups'),
    __param(0, (0, common_1.Query)('type')),
    __param(1, (0, common_1.Query)('direction')),
    __param(2, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], SetupController.prototype, "getActiveSetups", null);
__decorate([
    (0, common_1.Post)('setups/scan'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "triggerScan", null);
__decorate([
    (0, common_1.Get)('setups/simulate/:ticker'),
    __param(0, (0, common_1.Param)('ticker')),
    __param(1, (0, common_1.Query)('from')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "simulateSetups", null);
__decorate([
    (0, common_1.Get)('setups/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SetupController.prototype, "getSetupById", null);
__decorate([
    (0, common_1.Get)('setups/:id/evidence'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SetupController.prototype, "getSetupEvidence", null);
__decorate([
    (0, common_1.Get)('setups/:id/feedback'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "getSetupFeedback", null);
__decorate([
    (0, common_1.Post)('setups/:id/feedback'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "addSetupFeedback", null);
__decorate([
    (0, common_1.Get)('stocks/:ticker/evidence'),
    __param(0, (0, common_1.Param)('ticker')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "getStockEvidence", null);
__decorate([
    (0, common_1.Get)('event-log'),
    __param(0, (0, common_1.Query)('source')),
    __param(1, (0, common_1.Query)('event')),
    __param(2, (0, common_1.Query)('ticker')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "getEventLog", null);
exports.SetupController = SetupController = __decorate([
    (0, common_1.Controller)('api'),
    (0, nestjs_better_auth_1.AllowAnonymous)(),
    __metadata("design:paramtypes", [setup_orchestrator_service_1.SetupOrchestratorService,
        prisma_service_1.PrismaService])
], SetupController);
//# sourceMappingURL=setup.controller.js.map