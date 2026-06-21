import { AlmanacSetupPhase, Direction } from '@prisma/client';
import {
  detectTags,
  extractReportSlices,
  extractTickers,
  inferTradeCandidatesFromText,
} from './almanac-knowledge.service';

describe('almanac knowledge extraction', () => {
  it('extracts report date slices from page text', () => {
    const slices = extractReportSlices([
      'Foreword',
      'January 1, 2020\nTesla (TSLA) tested the Century Mark.',
      'More TSLA commentary.',
      'January 4, 2020\nAmazon.com (AMZN) pulled into the 200-dma.',
    ]);

    expect(slices).toHaveLength(2);
    expect(slices[0].pageStart).toBe(2);
    expect(slices[0].pageEnd).toBe(3);
    expect(slices[1].pageStart).toBe(4);
  });

  it('extracts company-style ticker mentions before bare uppercase words', () => {
    expect(
      extractTickers(
        'Tesla (TSLA) and Amazon.com (AMZN) both moved while the NASDAQ lagged.',
      ),
    ).toEqual(['TSLA', 'AMZN']);
  });

  it('creates trade candidates from Gilmo setup vocabulary', () => {
    const candidates = inferTradeCandidatesFromText(
      'DataDog (DDOG) posted a moving-average undercut & rally at the 50-dma. ' +
        'This MAU&R long entry used the 50-dma as a tight selling guide.',
      42,
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ticker: 'DDOG',
          setupTag: 'MAU&R',
          direction: Direction.LONG,
          phase: AlmanacSetupPhase.TRIGGERED,
          sourcePage: 42,
        }),
      ]),
    );
  });

  it('detects setup, catalyst, and mindset tags from text', () => {
    const text =
      'Netflix (NFLX) remained a short-sale target below the 20-dema after earnings.';

    expect(
      detectTags(text, [
        { tag: 'SHORT', phrases: ['short-sale'] },
        { tag: 'EARNINGS', phrases: ['earnings'] },
      ]),
    ).toEqual(['SHORT', 'EARNINGS']);
  });
});
