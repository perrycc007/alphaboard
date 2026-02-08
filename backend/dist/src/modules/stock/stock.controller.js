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
exports.StockController = void 0;
const common_1 = require("@nestjs/common");
const nestjs_better_auth_1 = require("@thallesp/nestjs-better-auth");
const stock_service_1 = require("./services/stock.service");
const screening_service_1 = require("./services/screening.service");
const client_1 = require("@prisma/client");
let StockController = class StockController {
    stockService;
    screeningService;
    constructor(stockService, screeningService) {
        this.stockService = stockService;
        this.screeningService = screeningService;
    }
    findAll(page, limit, search) {
        return this.stockService.findAll({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            search,
        });
    }
    screen(stage, category, isTemplate, minRsRank, sector) {
        const filter = {
            stage,
            category,
            isTemplate: isTemplate !== undefined ? isTemplate === 'true' : undefined,
            minRsRank: minRsRank ? parseFloat(minRsRank) : undefined,
            sector,
        };
        return this.screeningService.screen(filter);
    }
    findByTicker(ticker) {
        return this.stockService.findByTicker(ticker);
    }
    getDailyBars(ticker, limit) {
        return this.stockService.getDailyBars(ticker, limit ? parseInt(limit, 10) : undefined);
    }
    getIntradayBars(ticker) {
        return this.stockService.getIntradayBars(ticker);
    }
    getStageHistory(ticker) {
        return this.stockService.getStageHistory(ticker);
    }
};
exports.StockController = StockController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('screen'),
    __param(0, (0, common_1.Query)('stage')),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('isTemplate')),
    __param(3, (0, common_1.Query)('minRsRank')),
    __param(4, (0, common_1.Query)('sector')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "screen", null);
__decorate([
    (0, common_1.Get)(':ticker'),
    __param(0, (0, common_1.Param)('ticker')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "findByTicker", null);
__decorate([
    (0, common_1.Get)(':ticker/daily'),
    __param(0, (0, common_1.Param)('ticker')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getDailyBars", null);
__decorate([
    (0, common_1.Get)(':ticker/intraday'),
    __param(0, (0, common_1.Param)('ticker')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getIntradayBars", null);
__decorate([
    (0, common_1.Get)(':ticker/stage-history'),
    __param(0, (0, common_1.Param)('ticker')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getStageHistory", null);
exports.StockController = StockController = __decorate([
    (0, common_1.Controller)('api/stocks'),
    (0, nestjs_better_auth_1.AllowAnonymous)(),
    __metadata("design:paramtypes", [stock_service_1.StockService,
        screening_service_1.ScreeningService])
], StockController);
//# sourceMappingURL=stock.controller.js.map