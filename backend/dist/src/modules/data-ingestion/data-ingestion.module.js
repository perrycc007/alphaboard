"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataIngestionModule = void 0;
const common_1 = require("@nestjs/common");
const yfinance_provider_1 = require("./providers/yfinance.provider");
const polygon_provider_1 = require("./providers/polygon.provider");
const daily_sync_job_1 = require("./jobs/daily-sync.job");
const intraday_sync_job_1 = require("./jobs/intraday-sync.job");
const stage_recalc_job_1 = require("./jobs/stage-recalc.job");
const breadth_sync_job_1 = require("./jobs/breadth-sync.job");
const setup_scan_job_1 = require("./jobs/setup-scan.job");
const cleanup_job_1 = require("./jobs/cleanup.job");
const ticker_discovery_service_1 = require("./services/ticker-discovery.service");
const indicator_service_1 = require("./services/indicator.service");
const rs_rank_service_1 = require("./services/rs-rank.service");
const backfill_service_1 = require("./services/backfill.service");
const pipeline_service_1 = require("./services/pipeline.service");
const data_ingestion_controller_1 = require("./data-ingestion.controller");
const setup_module_1 = require("../setup/setup.module");
const alert_module_1 = require("../alert/alert.module");
const stock_module_1 = require("../stock/stock.module");
let DataIngestionModule = class DataIngestionModule {
};
exports.DataIngestionModule = DataIngestionModule;
exports.DataIngestionModule = DataIngestionModule = __decorate([
    (0, common_1.Module)({
        imports: [setup_module_1.SetupModule, alert_module_1.AlertModule, stock_module_1.StockModule],
        controllers: [data_ingestion_controller_1.DataIngestionController],
        providers: [
            yfinance_provider_1.YFinanceProvider,
            polygon_provider_1.PolygonProvider,
            ticker_discovery_service_1.TickerDiscoveryService,
            indicator_service_1.IndicatorService,
            rs_rank_service_1.RsRankService,
            backfill_service_1.BackfillService,
            pipeline_service_1.PipelineService,
            daily_sync_job_1.DailySyncJob,
            intraday_sync_job_1.IntradaySyncJob,
            stage_recalc_job_1.StageRecalcJob,
            breadth_sync_job_1.BreadthSyncJob,
            setup_scan_job_1.SetupScanJob,
            cleanup_job_1.CleanupJob,
        ],
        exports: [yfinance_provider_1.YFinanceProvider, polygon_provider_1.PolygonProvider, pipeline_service_1.PipelineService],
    })
], DataIngestionModule);
//# sourceMappingURL=data-ingestion.module.js.map