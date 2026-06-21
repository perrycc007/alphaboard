import { AlmanacSetupPhase, AlmanacTradeLabel, Direction } from '@prisma/client';
import {
  AlmanacKnowledgeService,
  buildOhlcvWindow,
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

  it('does not pair setup phrases with unrelated tickers elsewhere on the page', () => {
    const candidates = inferTradeCandidatesFromText(
      'Tesla (TSLA) drifted higher without a clear setup. ' +
        'Amazon.com (AMZN) pulled into the 200-dma; this moving average pullback offered support as a lower-risk entry.',
      11,
    );

    expect(candidates).toEqual([
      expect.objectContaining({
        ticker: 'AMZN',
        setupTag: 'MA_PULLBACK_200DMA',
      }),
    ]);
    expect(candidates.some((candidate) => candidate.ticker === 'TSLA')).toBe(false);
  });

  it('keeps the analysis wording as the source excerpt', () => {
    const candidates = inferTradeCandidatesFromText(
      'DataDog (DDOG) posted a moving-average undercut & rally at the 50-dma. ' +
        'This MAU&R long entry used the 50-dma as a tight selling guide and showed the technique clearly.',
      42,
    );

    expect(candidates[0].sourceExcerpt).toContain(
      'This MAU&R long entry used the 50-dma as a tight selling guide',
    );
  });

  it('uses local setup wording dates when available', () => {
    const candidates = inferTradeCandidatesFromText(
      'On February 3, DataDog (DDOG) posted a moving-average undercut & rally at the 50-dma. ' +
        'This MAU&R long entry used the 50-dma as a tight selling guide.',
      42,
      18,
      new Date('2022-01-31T00:00:00.000Z'),
    );

    expect(candidates[0].timeframeEnd?.toISOString().slice(0, 10)).toBe('2022-02-03');
  });

  it('builds OHLCV windows that end on the anchor date', () => {
    const window = buildOhlcvWindow(new Date('2022-02-03T00:00:00.000Z'));

    expect(window.windowEnd.toISOString().slice(0, 10)).toBe('2022-02-03');
    expect(window.windowStart < window.windowEnd).toBe(true);
    expect(window.calcStart < window.windowStart).toBe(true);
  });

  it('cleans only unclear trade cases before text rebuilds', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const service = new AlmanacKnowledgeService({
      almanacTradeCase: { deleteMany },
    } as any);

    await service.cleanupUnclearTradeCases();

    expect(deleteMany).toHaveBeenCalledWith({
      where: { label: AlmanacTradeLabel.UNCLEAR },
    });
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
