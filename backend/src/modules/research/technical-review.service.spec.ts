import { deriveTechnicalReviewStatus } from './technical-review.service';

describe('deriveTechnicalReviewStatus', () => {
  it('keeps weak risk/reward candidates out of focus', () => {
    expect(
      deriveTechnicalReviewStatus({
        hasImages: false,
        setupType: 'VCP',
        stage: 'STAGE_2',
        riskReward: 1.5,
        dataframeQualityScore: 85,
        groupConfirmation: 'strong group confirmation',
      }),
    ).toBe('REJECT');
  });

  it('focuses strong dataframe candidates with good risk/reward', () => {
    expect(
      deriveTechnicalReviewStatus({
        hasImages: false,
        setupType: 'PULLBACK_BUY',
        stage: 'STAGE_2',
        riskReward: 4,
        dataframeQualityScore: 78,
        groupConfirmation: 'group synchronized',
      }),
    ).toBe('FOCUS');
  });

  it('requires visual review when images were supplied but not scored', () => {
    expect(
      deriveTechnicalReviewStatus({
        hasImages: true,
        setupType: 'UNDERCUT_RALLY',
        stage: 'STAGE_1_OR_3',
        riskReward: 3,
        dataframeQualityScore: 70,
        groupConfirmation: 'unknown',
      }),
    ).toBe('NEEDS_VISUAL_REVIEW');
  });
});
