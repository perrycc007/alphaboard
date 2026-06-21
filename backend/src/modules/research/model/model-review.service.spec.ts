import { ModelReviewService } from './model-review.service';

describe('ModelReviewService', () => {
  it('persists prompt and payload with model review results', async () => {
    const prisma = {
      modelReview: {
        create: jest.fn().mockResolvedValue({ id: 'review-1' }),
      },
    };
    const provider = {
      name: 'mock',
      model: 'mock-model',
      review: jest.fn().mockResolvedValue({
        provider: 'mock',
        model: 'mock-model',
        inputTokens: 10,
        outputTokens: 5,
        costEstimate: 0,
        result: { verdict: 'WATCH' },
      }),
    };
    const service = new ModelReviewService(prisma as any, provider as any);

    await service.review({
      scanRunId: 'scan-1',
      reviewType: 'DATAFRAME_REVIEW',
      targetType: 'technical-review',
      targetId: 'ABCD',
      prompt: 'Review ABCD',
      payload: { ticker: 'ABCD' },
    });

    expect(prisma.modelReview.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scanRunId: 'scan-1',
        prompt: 'Review ABCD',
        payloadJson: { ticker: 'ABCD' },
        resultJson: { verdict: 'WATCH' },
      }),
    });
  });
});
