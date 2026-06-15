import {
  analyzeNumericStructure,
  buildSetupPerformanceSummary,
  classifyStructureDivergence,
} from './market-condition.service';
import { ALPHABOARD_SYSTEM_CONTEXT, reviewTypeGuidance } from './model/domain-context';

function points(values: number[]) {
  return values.map((value, index) => ({
    date: new Date(`2026-01-${String(index + 1).padStart(2, '0')}`),
    value,
  }));
}

describe('market condition structure detection', () => {
  it('classifies higher swing lows as an uptrend', () => {
    const structure = analyzeNumericStructure(
      points([10, 11, 13, 12, 11, 12, 14, 13, 12, 13, 15, 14, 13, 14, 16]),
    );

    expect(structure.trend).toBe('UPTREND');
    expect(structure.higherLow).toBe(true);
    expect(structure.risingTrendline).toBe(true);
  });

  it('classifies lower swing highs as a downtrend', () => {
    const structure = analyzeNumericStructure(
      points([16, 15, 13, 14, 15, 14, 12, 13, 14, 13, 11, 12, 13, 12, 10]),
    );

    expect(structure.trend).toBe('DOWNTREND');
    expect(structure.lowerHigh).toBe(true);
    expect(structure.fallingTrendline).toBe(true);
  });

  it('marks insufficient swings as unknown', () => {
    const structure = analyzeNumericStructure(points([10, 10.2, 10.4, 10.6, 10.8]));

    expect(structure.trend).toBe('UNKNOWN');
    expect(structure.reason).toBe('not_enough_points');
  });

  it('detects bearish divergence when cap-weight rises and internals fall', () => {
    const cap = analyzeNumericStructure(
      points([10, 11, 13, 12, 11, 12, 14, 13, 12, 13, 15, 14, 13, 14, 16]),
    );
    const equal = analyzeNumericStructure(
      points([16, 15, 13, 14, 15, 14, 12, 13, 14, 13, 11, 12, 13, 12, 10]),
    );

    expect(classifyStructureDivergence({ cap, equal, breadth: equal })).toBe(
      'BEARISH_DIVERGENCE',
    );
  });

  it('detects bullish divergence when cap-weight falls and internals rise', () => {
    const cap = analyzeNumericStructure(
      points([16, 15, 13, 14, 15, 14, 12, 13, 14, 13, 11, 12, 13, 12, 10]),
    );
    const equal = analyzeNumericStructure(
      points([10, 11, 13, 12, 11, 12, 14, 13, 12, 13, 15, 14, 13, 14, 16]),
    );

    expect(classifyStructureDivergence({ cap, equal, breadth: equal })).toBe(
      'BULLISH_DIVERGENCE',
    );
  });
});

describe('setup performance aggregation', () => {
  it('summarizes 2R/3R/4R hit rates, stops, durations, and distributions', () => {
    const summary = buildSetupPerformanceSummary([
      {
        family: 'TREND_LONG',
        setupType: 'VCP',
        direction: 'LONG',
        maxR: 4.2,
        finalR: 3.1,
        metadata: {
          rTargets: {
            '2': { hit: true, daysToHit: 3, pctMove: 6 },
            '3': { hit: true, daysToHit: 5, pctMove: 9 },
            '4': { hit: true, daysToHit: 8, pctMove: 12 },
          },
          stopHit: { hit: false },
        },
      },
      {
        family: 'TREND_LONG',
        setupType: 'VCP',
        direction: 'LONG',
        maxR: 2.3,
        finalR: -1,
        metadata: {
          rTargets: {
            '2': { hit: true, daysToHit: 4, pctMove: 5 },
            '3': { hit: false },
            '4': { hit: false },
          },
          stopHit: { hit: true },
        },
      },
    ] as any);

    const group = summary.groups[0];
    expect(group.sampleCount).toBe(2);
    expect(group.stopLossRate).toBe(0.5);
    expect(group.targets.find((target) => target.targetR === 2)?.winRate).toBe(1);
    expect(group.targets.find((target) => target.targetR === 3)?.winRate).toBe(0.5);
    expect(group.targets.find((target) => target.targetR === 4)?.medianHoldingDays).toBe(8);
    expect(group.maxRDistribution.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });
});

describe('market condition prompts', () => {
  it('includes strategy context and catalyst impact rules', () => {
    const catalystGuidance = reviewTypeGuidance('CATALYST_SEARCH');

    expect(ALPHABOARD_SYSTEM_CONTEXT).toContain('Investing is cause and effect');
    expect(ALPHABOARD_SYSTEM_CONTEXT).toContain('rates/liquidity');
    expect(ALPHABOARD_SYSTEM_CONTEXT).toContain('VCP');
    expect(ALPHABOARD_SYSTEM_CONTEXT).toContain('3R-5R');
    expect(catalystGuidance).toContain('causal chain');
    expect(catalystGuidance).toContain('rejection signals');
    expect(catalystGuidance).toContain('Never invent sources');
  });
});
