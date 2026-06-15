import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataIngestionModule } from '../data-ingestion/data-ingestion.module';
import { SetupModule } from '../setup/setup.module';
import { ResearchController } from './research.controller';
import { ScanRunService } from './scan-run.service';
import { FullScanService } from './full-scan.service';
import { UniverseFilterService } from './universe-filter.service';
import { FocusListService } from './focus-list.service';
import { DailyUpdateService } from './daily-update.service';
import { MarketConditionService } from './market-condition.service';
import { MetadataEnrichmentService } from './metadata-enrichment.service';
import { CatalystService } from './catalyst.service';
import { RecommendationService } from './recommendation.service';
import { StrategyReportService } from './strategy-report.service';
import { OpportunityHypothesisService } from './opportunity-hypothesis.service';
import { TechnicalReviewService } from './technical-review.service';
import { StrategyEffectivenessService } from './strategy-effectiveness.service';
import { ModelReviewService } from './model/model-review.service';
import { MockModelProvider } from './model/mock-model.provider';
import { QwenModelProvider } from './model/qwen-model.provider';
import { DeepSeekModelProvider } from './model/deepseek-model.provider';
import { MarketModelRouter } from './model/market-model.router';
import {
  MODEL_PROVIDER,
  ModelProvider,
} from './model/model-provider.interface';

/**
 * Research orchestration module. Coordinates existing pipeline/setup/market
 * services and instruments each run with `ScanRun` timing.
 *
 * The model provider is bound at runtime. DeepSeek handles text reasoning and
 * Qwen handles vision; when both keys are present they are combined behind a
 * router that picks the right one per request. If only one key is present that
 * provider is used directly, and with no key a zero-cost mock keeps the whole
 * workflow runnable end-to-end.
 */
@Module({
  imports: [DataIngestionModule, SetupModule],
  controllers: [ResearchController],
  providers: [
    ScanRunService,
    FullScanService,
    UniverseFilterService,
    FocusListService,
    DailyUpdateService,
    MarketConditionService,
    MetadataEnrichmentService,
    CatalystService,
    RecommendationService,
    StrategyReportService,
    OpportunityHypothesisService,
    TechnicalReviewService,
    StrategyEffectivenessService,
    ModelReviewService,
    {
      provide: MODEL_PROVIDER,
      useFactory: (config: ConfigService): ModelProvider => {
        const qwenKey =
          config.get<string>('DASHSCOPE_API_KEY') ??
          config.get<string>('QWEN_API_KEY');
        const deepseekKey = config.get<string>('DEEPSEEK_API_KEY');

        const textProvider = deepseekKey
          ? new DeepSeekModelProvider(config)
          : null;
        const visionProvider = qwenKey ? new QwenModelProvider(config) : null;

        if (textProvider && visionProvider) {
          return new MarketModelRouter(textProvider, visionProvider);
        }
        return textProvider ?? visionProvider ?? new MockModelProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    ScanRunService,
    UniverseFilterService,
    FocusListService,
    MarketConditionService,
    MetadataEnrichmentService,
    CatalystService,
    RecommendationService,
    StrategyReportService,
    OpportunityHypothesisService,
    TechnicalReviewService,
    StrategyEffectivenessService,
    ModelReviewService,
  ],
})
export class ResearchModule {}
