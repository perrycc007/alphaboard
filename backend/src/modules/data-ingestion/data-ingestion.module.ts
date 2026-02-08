import { Module } from '@nestjs/common';
import { YFinanceProvider } from './providers/yfinance.provider';
import { PolygonProvider } from './providers/polygon.provider';
import { DailySyncJob } from './jobs/daily-sync.job';
import { IntradaySyncJob } from './jobs/intraday-sync.job';
import { StageRecalcJob } from './jobs/stage-recalc.job';
import { BreadthSyncJob } from './jobs/breadth-sync.job';
import { SetupScanJob } from './jobs/setup-scan.job';
import { CleanupJob } from './jobs/cleanup.job';
import { SetupModule } from '../setup/setup.module';
import { AlertModule } from '../alert/alert.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [SetupModule, AlertModule, StockModule],
  providers: [
    YFinanceProvider,
    PolygonProvider,
    DailySyncJob,
    IntradaySyncJob,
    StageRecalcJob,
    BreadthSyncJob,
    SetupScanJob,
    CleanupJob,
  ],
  exports: [YFinanceProvider, PolygonProvider],
})
export class DataIngestionModule {}
