import { Module } from '@nestjs/common';
import { YFinanceProvider } from './providers/yfinance.provider';
import { PolygonProvider } from './providers/polygon.provider';
import { DailySyncJob } from './jobs/daily-sync.job';
import { IntradaySyncJob } from './jobs/intraday-sync.job';
import { StageRecalcJob } from './jobs/stage-recalc.job';
import { BreadthSyncJob } from './jobs/breadth-sync.job';
import { SetupScanJob } from './jobs/setup-scan.job';
import { CleanupJob } from './jobs/cleanup.job';
import { TickerDiscoveryService } from './services/ticker-discovery.service';
import { IndicatorService } from './services/indicator.service';
import { RsRankService } from './services/rs-rank.service';
import { BackfillService } from './services/backfill.service';
import { PipelineService } from './services/pipeline.service';
import { DataIngestionController } from './data-ingestion.controller';
import { SetupModule } from '../setup/setup.module';
import { AlertModule } from '../alert/alert.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [SetupModule, AlertModule, StockModule],
  controllers: [DataIngestionController],
  providers: [
    // Providers
    YFinanceProvider,
    PolygonProvider,
    // New pipeline services
    TickerDiscoveryService,
    IndicatorService,
    RsRankService,
    BackfillService,
    PipelineService,
    // Existing jobs
    DailySyncJob,
    IntradaySyncJob,
    StageRecalcJob,
    BreadthSyncJob,
    SetupScanJob,
    CleanupJob,
  ],
  exports: [YFinanceProvider, PolygonProvider, PipelineService],
})
export class DataIngestionModule {}
