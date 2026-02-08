import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { appConfig, polygonConfig, databaseConfig } from './config/app.config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MarketModule } from './modules/market/market.module';
import { StockModule } from './modules/stock/stock.module';
import { ThemeModule } from './modules/theme/theme.module';
import { SetupModule } from './modules/setup/setup.module';
import { TradeModule } from './modules/trade/trade.module';
import { RiskModule } from './modules/risk/risk.module';
import { AlertModule } from './modules/alert/alert.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';
import { DataIngestionModule } from './modules/data-ingestion/data-ingestion.module';
import { BrokerModule } from './modules/broker/broker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, polygonConfig, databaseConfig],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    MarketModule,
    StockModule,
    ThemeModule,
    SetupModule,
    TradeModule,
    RiskModule,
    AlertModule,
    WatchlistModule,
    DataIngestionModule,
    BrokerModule,
  ],
})
export class AppModule {}
