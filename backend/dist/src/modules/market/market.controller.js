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
exports.MarketController = void 0;
const common_1 = require("@nestjs/common");
const nestjs_better_auth_1 = require("@thallesp/nestjs-better-auth");
const market_service_1 = require("./market.service");
const breadth_service_1 = require("./breadth.service");
const market_regime_service_1 = require("./market-regime.service");
const client_1 = require("@prisma/client");
let MarketController = class MarketController {
    marketService;
    breadthService;
    marketRegimeService;
    constructor(marketService, breadthService, marketRegimeService) {
        this.marketService = marketService;
        this.breadthService = breadthService;
        this.marketRegimeService = marketRegimeService;
    }
    getOverview() {
        return this.marketService.getOverview();
    }
    getBreadthTimeSeries(range) {
        return this.breadthService.getTimeSeries(range);
    }
    getIndexDaily(ticker, range) {
        return this.marketService.getIndexDaily(ticker, range);
    }
    getRegimes(from, to, granularity = client_1.MarketPeriodGranularity.REGIME) {
        return this.marketRegimeService.listPeriods(from, to, granularity);
    }
    async getRegimeReport(from, to, format = 'json', granularity = client_1.MarketPeriodGranularity.REGIME) {
        if (format === 'markdown') {
            return {
                format: 'markdown',
                content: await this.marketRegimeService.renderReport(from, to, granularity),
            };
        }
        return this.marketRegimeService.listPeriods(from, to, granularity);
    }
    getLeaderTimeline(ticker, from, to, granularity = client_1.MarketPeriodGranularity.MONTH) {
        return this.marketRegimeService.getLeaderTimeline(ticker, from, to, granularity);
    }
    getRegimeById(id) {
        return this.marketRegimeService.getPeriod(id);
    }
    rebuildRegimes() {
        return this.marketRegimeService.rebuildAll();
    }
};
exports.MarketController = MarketController;
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('breadth'),
    __param(0, (0, common_1.Query)('range')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "getBreadthTimeSeries", null);
__decorate([
    (0, common_1.Get)('indices/:ticker/daily'),
    __param(0, (0, common_1.Param)('ticker')),
    __param(1, (0, common_1.Query)('range')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "getIndexDaily", null);
__decorate([
    (0, common_1.Get)('regimes'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "getRegimes", null);
__decorate([
    (0, common_1.Get)('regimes/report'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('format')),
    __param(3, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], MarketController.prototype, "getRegimeReport", null);
__decorate([
    (0, common_1.Get)('regimes/leader/:ticker'),
    __param(0, (0, common_1.Param)('ticker')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('granularity')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "getLeaderTimeline", null);
__decorate([
    (0, common_1.Get)('regimes/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "getRegimeById", null);
__decorate([
    (0, common_1.Post)('regimes/rebuild'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MarketController.prototype, "rebuildRegimes", null);
exports.MarketController = MarketController = __decorate([
    (0, common_1.Controller)('api/market'),
    (0, nestjs_better_auth_1.AllowAnonymous)(),
    __metadata("design:paramtypes", [market_service_1.MarketService,
        breadth_service_1.BreadthService,
        market_regime_service_1.MarketRegimeService])
], MarketController);
//# sourceMappingURL=market.controller.js.map