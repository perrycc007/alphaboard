"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketModule = void 0;
const common_1 = require("@nestjs/common");
const market_controller_1 = require("./market.controller");
const market_service_1 = require("./market.service");
const breadth_service_1 = require("./breadth.service");
const market_regime_service_1 = require("./market-regime.service");
const stock_module_1 = require("../stock/stock.module");
const setup_module_1 = require("../setup/setup.module");
const indicator_service_1 = require("../data-ingestion/services/indicator.service");
let MarketModule = class MarketModule {
};
exports.MarketModule = MarketModule;
exports.MarketModule = MarketModule = __decorate([
    (0, common_1.Module)({
        imports: [stock_module_1.StockModule, setup_module_1.SetupModule],
        controllers: [market_controller_1.MarketController],
        providers: [market_service_1.MarketService, breadth_service_1.BreadthService, market_regime_service_1.MarketRegimeService, indicator_service_1.IndicatorService],
        exports: [market_service_1.MarketService, breadth_service_1.BreadthService, market_regime_service_1.MarketRegimeService],
    })
], MarketModule);
//# sourceMappingURL=market.module.js.map