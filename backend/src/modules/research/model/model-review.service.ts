import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModelReview, ModelReviewType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MODEL_PROVIDER } from './model-provider.interface';
import type {
  ModelProvider,
  ModelReviewRequest,
} from './model-provider.interface';

export interface ReviewOptions extends ModelReviewRequest {
  scanRunId?: string;
}

/**
 * Runs a model review through the configured provider and persists the call
 * (provider, tokens, cost, result) for cost tracking and auditability.
 */
@Injectable()
export class ModelReviewService {
  private readonly logger = new Logger(ModelReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MODEL_PROVIDER) private readonly provider: ModelProvider,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async review(options: ReviewOptions): Promise<ModelReview> {
    const response = await this.provider.review(options);

    return this.prisma.modelReview.create({
      data: {
        scanRunId: options.scanRunId ?? null,
        reviewType: options.reviewType,
        provider: response.provider,
        model: response.model,
        inputTokens: response.inputTokens ?? null,
        outputTokens: response.outputTokens ?? null,
        costEstimate:
          response.costEstimate != null
            ? new Prisma.Decimal(response.costEstimate)
            : null,
        targetType: options.targetType ?? null,
        targetId: options.targetId ?? null,
        prompt: options.prompt,
        payloadJson: (options.payload ?? {}) as Prisma.InputJsonValue,
        resultJson: (response.result ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  list(reviewType?: ModelReviewType, limit = 50): Promise<ModelReview[]> {
    return this.prisma.modelReview.findMany({
      where: reviewType ? { reviewType } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
