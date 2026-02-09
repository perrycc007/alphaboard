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
    (0, common_1.Get)('stocks/:ticker/evidence'),
    __param(0, (0, common_1.Param)('ticker')),
    __param(1, (0, common_1.Query)('timeframe')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SetupController.prototype, "getStockEvidence", null);
exports.SetupController = SetupController = __decorate([
    (0, common_1.Controller)('api'),
    (0, nestjs_better_auth_1.AllowAnonymous)(),
    __metadata("design:paramtypes", [setup_orchestrator_service_1.SetupOrchestratorService,
        prisma_service_1.PrismaService])
], SetupController);
//# sourceMappingURL=setup.controller.js.map