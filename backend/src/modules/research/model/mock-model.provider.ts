import { Injectable, Logger } from '@nestjs/common';
import {
  ModelProvider,
  ModelReviewRequest,
  ModelReviewResponse,
} from './model-provider.interface';

/**
 * Deterministic, zero-cost stand-in for a real model provider. Used until the
 * Qwen (or other) API key is configured. It echoes a structured, schema-shaped
 * result so downstream code can be built and exercised end-to-end without keys.
 */
@Injectable()
export class MockModelProvider implements ModelProvider {
  readonly name = 'mock';
  readonly model = 'mock-v0';
  private readonly logger = new Logger(MockModelProvider.name);

  review(request: ModelReviewRequest): Promise<ModelReviewResponse> {
    this.logger.debug(`Mock review: ${request.reviewType} ${request.targetId ?? ''}`);
    const result = this.buildResult(request);
    return Promise.resolve({
      provider: this.name,
      model: this.model,
      inputTokens: 0,
      outputTokens: 0,
      costEstimate: 0,
      result,
    });
  }

  private buildResult(request: ModelReviewRequest): Record<string, unknown> {
    const base = {
      mock: true,
      reviewType: request.reviewType,
      targetType: request.targetType ?? null,
      targetId: request.targetId ?? null,
      note: 'Mock provider — no real model was called. Configure QWEN_API_KEY to enable real reviews.',
    };

    switch (request.reviewType) {
      case 'METADATA_ENRICHMENT':
        return {
          ...base,
          briefDescription: null,
          tradableType: 'STOCK',
          isTradable: true,
          themes: [],
        };
      case 'CATALYST_SEARCH':
        return {
          ...base,
          title: 'Pending catalyst review',
          hypothesis: 'Awaiting model — no automated catalyst generated.',
          beneficiaries: [],
          losers: [],
          sourceUrls: [],
          confidence: 0,
        };
      case 'DATAFRAME_REVIEW':
      case 'CHART_REVIEW':
        return {
          ...base,
          verdict: 'UNDECIDED',
          quality: 0,
          reasons: ['Mock provider — manual review required'],
        };
      case 'STRATEGY_REPORT':
        return {
          ...base,
          summary: 'Mock strategy report — manual judgement required.',
          recommendations: [],
        };
      default:
        return base;
    }
  }
}
