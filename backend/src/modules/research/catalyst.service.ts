import { Injectable, Logger } from '@nestjs/common';
import { CatalystHypothesis, CatalystStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelReviewService } from './model/model-review.service';

interface CatalystModelResult {
  title?: string;
  hypothesis?: string;
  beneficiaries?: unknown[];
  losers?: unknown[];
  sourceUrls?: unknown[];
  confidence?: number;
}

export interface CreateCatalystInput {
  title: string;
  hypothesis: string;
  themeId?: string;
  groupId?: string;
  sourceUrls?: string[];
  expectedBeneficiaries?: unknown[];
  expectedLosers?: unknown[];
  confidenceScore?: number;
}

/**
 * Generates and tracks catalyst hypotheses (theme/group level). Generation
 * runs through the model provider (mock until a key is configured); created
 * hypotheses start in WATCHING and are confirmed/rejected as evidence accrues.
 */
@Injectable()
export class CatalystService {
  private readonly logger = new Logger(CatalystService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modelReview: ModelReviewService,
  ) {}

  async generateForTheme(
    themeId: string,
    scanRunId?: string,
  ): Promise<CatalystHypothesis | null> {
    const theme = await this.prisma.theme.findUniqueOrThrow({
      where: { id: themeId },
      include: { groups: { select: { name: true } } },
    });

    const review = await this.modelReview.review({
      reviewType: 'CATALYST_SEARCH',
      targetType: 'theme',
      targetId: theme.id,
      scanRunId,
      prompt:
        'Identify the single strongest current catalyst for this theme and frame it so price action can confirm or reject it. ' +
        'beneficiaries and losers should be specific tickers/groups across the supply chain. ' +
        'Return JSON with keys: title (string), hypothesis (string), ' +
        'beneficiaries (array of strings), losers (array of strings), ' +
        'sourceUrls (array of strings — only real URLs you are confident about, else empty), ' +
        'confidence (0-1 reflecting evidence strength).',
      payload: {
        theme: theme.name,
        description: theme.description,
        groups: theme.groups.map((g) => g.name),
      },
    });

    const result = (review.resultJson ?? {}) as CatalystModelResult;
    // The mock provider returns confidence 0 and an empty hypothesis — skip
    // persisting an empty catalyst so we don't pollute the table.
    if (!result.hypothesis || (result.confidence ?? 0) <= 0) {
      this.logger.debug(`No catalyst generated for theme ${theme.name} (mock/empty)`);
      return null;
    }

    return this.create({
      title: result.title ?? `${theme.name} catalyst`,
      hypothesis: result.hypothesis,
      themeId: theme.id,
      sourceUrls: this.toStringArray(result.sourceUrls),
      expectedBeneficiaries: result.beneficiaries ?? [],
      expectedLosers: result.losers ?? [],
      confidenceScore: result.confidence,
    });
  }

  create(input: CreateCatalystInput): Promise<CatalystHypothesis> {
    return this.prisma.catalystHypothesis.create({
      data: {
        title: input.title,
        hypothesis: input.hypothesis,
        themeId: input.themeId ?? null,
        groupId: input.groupId ?? null,
        sourceUrlsJson: this.toJson(input.sourceUrls),
        expectedBeneficiariesJson: this.toJson(input.expectedBeneficiaries),
        expectedLosersJson: this.toJson(input.expectedLosers),
        confidenceScore:
          input.confidenceScore != null
            ? new Prisma.Decimal(Math.max(0, Math.min(1, input.confidenceScore)))
            : null,
      },
    });
  }

  list(status?: CatalystStatus, limit = 50): Promise<CatalystHypothesis[]> {
    return this.prisma.catalystHypothesis.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { theme: { select: { name: true } } },
    });
  }

  get(id: string): Promise<CatalystHypothesis | null> {
    return this.prisma.catalystHypothesis.findUnique({ where: { id } });
  }

  updateStatus(id: string, status: CatalystStatus): Promise<CatalystHypothesis> {
    return this.prisma.catalystHypothesis.update({
      where: { id },
      data: { status },
    });
  }

  private toStringArray(value: unknown[] | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string');
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;
    return value as Prisma.InputJsonValue;
  }
}
