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
const market_service_1 = require("./market.service");
const breadth_service_1 = require("./breadth.service");
let MarketController = class MarketController {
    marketService;
    breadthService;
    constructor(marketService, breadthService) {
        this.marketService = marketService;
        this.breadthService = breadthService;
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
exports.MarketController = MarketController = __decorate([
    (0, common_1.Controller)('api/market'),
    __metadata("design:paramtypes", [market_service_1.MarketService,
        breadth_service_1.BreadthService])
], MarketController);
//# sourceMappingURL=market.controller.js.map