"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const app_config_1 = require("./config/app.config");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const market_module_1 = require("./modules/market/market.module");
const stock_module_1 = require("./modules/stock/stock.module");
const theme_module_1 = require("./modules/theme/theme.module");
const setup_module_1 = require("./modules/setup/setup.module");
const trade_module_1 = require("./modules/trade/trade.module");
const risk_module_1 = require("./modules/risk/risk.module");
const alert_module_1 = require("./modules/alert/alert.module");
const watchlist_module_1 = require("./modules/watchlist/watchlist.module");
const data_ingestion_module_1 = require("./modules/data-ingestion/data-ingestion.module");
const broker_module_1 = require("./modules/broker/broker.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [app_config_1.appConfig, app_config_1.polygonConfig, app_config_1.databaseConfig],
            }),
            schedule_1.ScheduleModule.forRoot(),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            market_module_1.MarketModule,
            stock_module_1.StockModule,
            theme_module_1.ThemeModule,
            setup_module_1.SetupModule,
            trade_module_1.TradeModule,
            risk_module_1.RiskModule,
            alert_module_1.AlertModule,
            watchlist_module_1.WatchlistModule,
            data_ingestion_module_1.DataIngestionModule,
            broker_module_1.BrokerModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map