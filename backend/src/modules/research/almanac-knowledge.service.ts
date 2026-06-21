import { Injectable } from '@nestjs/common';
import {
  AlmanacSetupPhase,
  AlmanacSourceConfidence,
  AlmanacTradeLabel,
  Direction,
  Prisma,
} from '@prisma/client';
import { execFile } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { basename, join, resolve } from 'path';
import { promisify } from 'util';
import { PrismaService } from '../../prisma/prisma.service';

const execFileAsync = promisify(execFile);

const ALMANAC_DIR = join('docs', 'book', 'Almanac');
const ARTIFACT_DIR = join('artifacts', 'almanac');
const MAX_EXCERPT_CHARS = 900;
const MAX_TRADE_CASES_PER_REPORT = 18;
const EXCLUDED_DAILY_SETUP_TAGS = ['620_TIMING'];

const REPORT_DATE_RE =
  /(?:^|\n)(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g;
const INLINE_DATE_RE =
  /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s+\d{4})?\b/i;
const COMPANY_TICKER_RE = /\(([A-Z][A-Z0-9.$-]{0,7})\)/g;
const BARE_TICKER_RE = /\b[A-Z][A-Z0-9.$-]{1,5}\b/g;
const ANALYSIS_CONTEXT_PHRASES = [
  'entry',
  'set-up',
  'setup',
  'selling guide',
  'buy point',
  'short-sale',
  'shortable',
  'support',
  'resistance',
  'pullback',
  'trigger',
  'reversal',
  'failure',
  'breakout',
  'volume',
  'lower-risk',
  'opportunistic',
  'tight',
];

const SETUP_RULES: Array<{
  tag: string;
  phrases: string[];
  direction?: Direction;
  phase: AlmanacSetupPhase;
}> = [
  {
    tag: 'U&R',
    phrases: ['U&R', 'undercut & rally', 'undercut and rally'],
    direction: Direction.LONG,
    phase: AlmanacSetupPhase.TRIGGERED,
  },
  {
    tag: 'MAU&R',
    phrases: ['MAU&R', 'moving average undercut & rally', 'moving-average undercut & rally'],
    direction: Direction.LONG,
    phase: AlmanacSetupPhase.TRIGGERED,
  },
  {
    tag: 'POCKET_PIVOT',
    phrases: ['pocket pivot'],
    direction: Direction.LONG,
    phase: AlmanacSetupPhase.TRIGGERED,
  },
  {
    tag: 'BUYABLE_GAP_UP',
    phrases: ['buyable gap-up', 'BGU'],
    direction: Direction.LONG,
    phase: AlmanacSetupPhase.TRIGGERED,
  },
  {
    tag: 'CENTURY_MARK',
    phrases: ['Century Mark', 'Millennial Mark'],
    phase: AlmanacSetupPhase.REFERENCE,
  },
  {
    tag: 'MA_PULLBACK_20DEMA',
    phrases: ['20-dema', '20-day exponential', '20-day line'],
    phase: AlmanacSetupPhase.APPROACHING,
  },
  {
    tag: 'MA_PULLBACK_50DMA',
    phrases: ['50-dma', '50-day moving average', '50-day line'],
    phase: AlmanacSetupPhase.APPROACHING,
  },
  {
    tag: 'MA_PULLBACK_200DMA',
    phrases: ['200-dma', '200-day moving average', '200-day line'],
    phase: AlmanacSetupPhase.APPROACHING,
  },
  {
    tag: 'LSFB_BASE_FAILURE',
    phrases: ['late-stage failed-base', 'LSFB', 'failed-base', 'base failure'],
    direction: Direction.SHORT,
    phase: AlmanacSetupPhase.FAILED,
  },
  {
    tag: 'DOUBLE_TOP',
    phrases: ['double-top', 'double top'],
    direction: Direction.SHORT,
    phase: AlmanacSetupPhase.TOUCHED,
  },
  {
    tag: 'BEAR_FLAG',
    phrases: ['bear flag'],
    direction: Direction.SHORT,
    phase: AlmanacSetupPhase.REFERENCE,
  },
  {
    tag: '360_DEGREE',
    phrases: ['360-degree', 'two-sided set-up', 'two-sided setup'],
    phase: AlmanacSetupPhase.REFERENCE,
  },
];

const CATALYST_RULES: Array<{ tag: string; phrases: string[] }> = [
  { tag: 'EARNINGS', phrases: ['earnings', 'earnings report'] },
  { tag: 'FED_LIQUIDITY', phrases: ['Fed', 'Federal Reserve', 'QE', 'interest rate'] },
  { tag: 'CRYPTO', phrases: ['Bitcoin', 'crypto'] },
  { tag: 'METAVERSE', phrases: ['metaverse'] },
  { tag: 'DELIVERIES', phrases: ['deliveries', 'sales and delivery'] },
  { tag: 'GAP_NEWS', phrases: ['gap-up', 'gapping up', 'gap-down', 'gapping down'] },
];

const MINDSET_RULES: Array<{ tag: string; phrases: string[] }> = [
  { tag: 'OPPORTUNISTIC_ENTRIES', phrases: ['opportunistic', 'lower-risk entry'] },
  { tag: 'DO_NOT_CHASE', phrases: ['do not chase', 'don’t chase', 'shunning breakouts'] },
  { tag: 'TIGHT_SELLING_GUIDE', phrases: ['tight selling guide', 'selling guide'] },
  { tag: '360_DEGREE_THINKING', phrases: ['360-degree', 'two-sided'] },
  { tag: 'HUMILITY_DIARY', phrases: ['trading diary', 'face the music', 'students of the market'] },
  { tag: 'REAL_TIME_EVIDENCE', phrases: ['real-time price/volume evidence', 'play it as it lies'] },
];

const DOCTRINE_SEEDS = [
  {
    title: 'U&R and MAU&R entry logic',
    summary:
      'Treat undercut-and-rally entries as price-level reclaims. The reclaimed low or moving average becomes the primary selling guide, with only modest downside porosity.',
    setupTags: ['U&R', 'MAU&R'],
    mindsetTags: ['TIGHT_SELLING_GUIDE', 'OPPORTUNISTIC_ENTRIES'],
  },
  {
    title: 'Moving averages as tactical reference points',
    summary:
      'Use the 10-dma, 20-dema, 50-dma, and 200-dma as tactical support, resistance, entry, stop, and covering-guide references rather than abstract indicators.',
    setupTags: ['MA_PULLBACK_20DEMA', 'MA_PULLBACK_50DMA', 'MA_PULLBACK_200DMA'],
    mindsetTags: ['REAL_TIME_EVIDENCE'],
  },
  {
    title: '360-degree setup posture',
    summary:
      'A stock at a key level can resolve long or short. Keep both paths active until real-time price and volume evidence confirms one side.',
    setupTags: ['360_DEGREE'],
    mindsetTags: ['360_DEGREE_THINKING', 'REAL_TIME_EVIDENCE'],
  },
  {
    title: 'Avoid chasing strength',
    summary:
      'Prefer opportunistic pullbacks, shakeouts, and tight-risk entries over extended breakouts or one-day strength that leaves no controlled selling guide.',
    setupTags: ['POCKET_PIVOT', 'BUYABLE_GAP_UP'],
    mindsetTags: ['DO_NOT_CHASE', 'OPPORTUNISTIC_ENTRIES'],
  },
  {
    title: 'Late-stage failure and short-sale transitions',
    summary:
      'Failed late-stage bases, breaks below key moving averages, and rallies into moving-average resistance can transition former leaders into short-sale targets.',
    setupTags: ['LSFB_BASE_FAILURE', 'BEAR_FLAG', 'DOUBLE_TOP'],
    mindsetTags: ['360_DEGREE_THINKING'],
  },
];

export interface AlmanacImportOptions {
  extractImages?: boolean;
  linkChartsOnly?: boolean;
  cleanupUnclear?: boolean;
  sourceFile?: string;
  maxTradeCasesPerReport?: number;
}

export interface AlmanacFilters {
  q?: string;
  ticker?: string;
  setupTag?: string;
  catalystTag?: string;
  mindsetTag?: string;
  year?: number;
  quarter?: number;
  label?: AlmanacTradeLabel;
  page?: number;
  limit?: number;
}

export interface AlmanacOhlcvResponse {
  tradeCaseId: string;
  ticker: string;
  status: 'LOCAL' | 'FETCHED' | 'MISSING' | 'INVALID_TICKER';
  message: string | null;
  reportDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  bars: Array<{
    id: string;
    stockId: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sma20: number | null;
    sma50: number | null;
    sma150: number | null;
    sma200: number | null;
    ema6: number | null;
    ema20: number | null;
    rsRank: number | null;
    atr14: number | null;
  }>;
}

interface PdfInfo {
  title?: string;
  pages: number;
  fileSizeBytes?: bigint;
}

interface ChartImageInfo {
  pageNumber: number;
  imageNumber: number;
  width?: number;
  height?: number;
  chartType?: string;
}

interface ReportSlice {
  reportDate: Date;
  pageStart: number;
  pageEnd: number;
  pages: Array<{ pageNumber: number; text: string }>;
}

export function detectTags(text: string, rules: Array<{ tag: string; phrases: string[] }>): string[] {
  const normalized = text.toLowerCase();
  return rules
    .filter((rule) =>
      rule.phrases.some((phrase) => normalized.includes(phrase.toLowerCase())),
    )
    .map((rule) => rule.tag);
}

export function extractTickers(text: string): string[] {
  const ignored = new Set([
    'A',
    'AC',
    'AM',
    'AND',
    'BGU',
    'CEO',
    'CFO',
    'DMA',
    'EMA',
    'ETF',
    'Fed',
    'IPO',
    'LSFB',
    'MAU',
    'NYSE',
    'QE',
    'QQQ',
    'SMA',
    'SPY',
    'U',
    'USD',
  ].map((item) => item.toUpperCase()));
  const tickers = new Set<string>();

  for (const match of text.matchAll(COMPANY_TICKER_RE)) {
    const ticker = normalizeTicker(match[1]);
    if (ticker && !ignored.has(ticker)) tickers.add(ticker);
  }

  if (tickers.size === 0) {
    for (const match of text.matchAll(BARE_TICKER_RE)) {
      const ticker = normalizeTicker(match[0]);
      if (ticker && !ignored.has(ticker)) tickers.add(ticker);
      if (tickers.size >= 6) break;
    }
  }

  return [...tickers].slice(0, 10);
}

export function extractReportSlices(pages: string[]): ReportSlice[] {
  const starts: Array<{ pageNumber: number; date: Date }> = [];
  pages.forEach((page, index) => {
    const match = page.match(REPORT_DATE_RE);
    if (!match) return;
    const firstDate = match[0].trim();
    const date = new Date(`${firstDate} UTC`);
    if (!Number.isNaN(date.getTime())) {
      starts.push({ pageNumber: index + 1, date });
    }
  });

  return starts.map((start, index) => {
    const next = starts[index + 1];
    const pageEnd = next ? next.pageNumber - 1 : pages.length;
    return {
      reportDate: start.date,
      pageStart: start.pageNumber,
      pageEnd,
      pages: pages
        .slice(start.pageNumber - 1, pageEnd)
        .map((text, offset) => ({
          pageNumber: start.pageNumber + offset,
          text,
        })),
    };
  });
}

export function inferTradeCandidatesFromText(
  text: string,
  pageNumber: number,
  maxCases = MAX_TRADE_CASES_PER_REPORT,
  reportDate?: Date,
) {
  const tickers = extractTickers(text);
  if (tickers.length === 0) return [];

  const candidates: Array<{
    ticker: string;
    setupTag: string;
    direction?: Direction;
    phase: AlmanacSetupPhase;
    catalystTags: string[];
    mindsetTags: string[];
    sourcePage: number;
    sourceExcerpt: string;
    sourceConfidence: AlmanacSourceConfidence;
    timeframeStart?: Date;
    timeframeEnd?: Date;
  }> = [];
  const evidenceBlocks = buildEvidenceBlocks(text);
  const seen = new Set<string>();

  for (const block of evidenceBlocks) {
    const blockTickers = extractTickers(block.text);
    if (blockTickers.length === 0) continue;
    if (!hasAnalysisContext(block.text)) continue;

    for (const rule of SETUP_RULES) {
      const phrase = rule.phrases.find((item) =>
        block.text.toLowerCase().includes(item.toLowerCase()),
      );
      if (!phrase) continue;
      const tickers = extractTickersNearPhrase(block.text, phrase, blockTickers);
      if (tickers.length === 0) continue;

      for (const ticker of tickers.slice(0, 2)) {
        const sourceExcerpt = normalizeAnalysisBlock(block.text);
        const candidateKey = `${ticker}::${rule.tag}::${sourceExcerpt}`;
        if (seen.has(candidateKey)) continue;
        seen.add(candidateKey);
        const localDate = extractInlineDate(block.text, reportDate);
        candidates.push({
          ticker,
          setupTag: rule.tag,
          direction: inferDirection(rule, block.text),
          phase: rule.phase,
          catalystTags: detectTags(block.text, CATALYST_RULES),
          mindsetTags: detectTags(block.text, MINDSET_RULES),
          sourcePage: pageNumber,
          sourceExcerpt,
          sourceConfidence: block.text.includes(`(${ticker})`)
            ? AlmanacSourceConfidence.HIGH
            : AlmanacSourceConfidence.MEDIUM,
          timeframeStart: localDate,
          timeframeEnd: localDate,
        });
        if (candidates.length >= maxCases) return candidates;
      }
    }
  }

  return candidates;
}

function extractTickersNearPhrase(
  text: string,
  phrase: string,
  blockTickers: string[],
): string[] {
  const phraseLower = phrase.toLowerCase();
  const phraseSentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.toLowerCase().includes(phraseLower));
  const sentenceTickers = phraseSentences.flatMap((sentence) => extractTickers(sentence));
  if (sentenceTickers.length > 0) return [...new Set(sentenceTickers)];
  return blockTickers.length === 1 ? blockTickers : [];
}

function buildEvidenceBlocks(text: string): Array<{ text: string }> {
  const normalized = text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return [];

  const paragraphBlocks = normalized
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\n+/g, ' ').trim())
    .filter((block) => block.length >= 40);
  const blocks = paragraphBlocks.length > 1 ? paragraphBlocks : sentenceWindows(normalized);
  return blocks.map((block) => ({ text: block })).slice(0, 80);
}

function sentenceWindows(text: string): string[] {
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return [text.replace(/\n+/g, ' ').trim()];

  const windows: string[] = [];
  for (let index = 0; index < sentences.length; index++) {
    windows.push(sentences.slice(Math.max(0, index - 1), index + 2).join(' '));
  }
  return windows;
}

function hasAnalysisContext(text: string): boolean {
  const lower = text.toLowerCase();
  return ANALYSIS_CONTEXT_PHRASES.some((phrase) => lower.includes(phrase));
}

function normalizeAnalysisBlock(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= MAX_EXCERPT_CHARS) return flat;
  return `${flat.slice(0, MAX_EXCERPT_CHARS - 3).trim()}...`;
}

function extractInlineDate(text: string, fallbackYear?: Date): Date | undefined {
  const match = text.match(INLINE_DATE_RE)?.[0];
  if (!match) return undefined;
  const dateText = /\d{4}/.test(match)
    ? match
    : fallbackYear
      ? `${match}, ${fallbackYear.getUTCFullYear()}`
      : undefined;
  if (!dateText) return undefined;
  const date = new Date(`${dateText} UTC`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function inferDirection(
  rule: (typeof SETUP_RULES)[number],
  text: string,
): Direction | undefined {
  if (rule.direction) return rule.direction;
  const lower = text.toLowerCase();
  if (lower.includes('short-sale') || lower.includes('shortable')) {
    return Direction.SHORT;
  }
  if (lower.includes('buyable') || lower.includes('long entry')) {
    return Direction.LONG;
  }
  return undefined;
}

function excerptAround(text: string, needle: string, size = MAX_EXCERPT_CHARS): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const idx = flat.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return flat.slice(0, size);
  const start = Math.max(0, idx - Math.floor(size / 2));
  const excerpt = flat.slice(start, start + size);
  return `${start > 0 ? '...' : ''}${excerpt}${start + size < flat.length ? '...' : ''}`;
}

function normalizeTicker(raw: string): string | null {
  const ticker = raw.replace(/[^A-Z0-9.$-]/g, '').toUpperCase();
  if (ticker.length < 1 || ticker.length > 8) return null;
  return ticker;
}

@Injectable()
export class AlmanacKnowledgeService {
  private readonly repoRoot = this.resolveRepoRoot();
  private readonly almanacRoot = join(this.repoRoot, ALMANAC_DIR);
  private readonly artifactRoot = join(this.repoRoot, ARTIFACT_DIR);

  constructor(private readonly prisma: PrismaService) {}

  async importLibrary(options: AlmanacImportOptions = {}) {
    if (!existsSync(this.almanacRoot)) {
      throw new Error(`Almanac folder not found: ${this.almanacRoot}`);
    }

    if (options.cleanupUnclear) {
      await this.cleanupUnclearTradeCases(options.sourceFile);
    }

    mkdirSync(this.artifactRoot, { recursive: true });
    const pdfFiles = readdirSync(this.almanacRoot)
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .filter((file) => !options.sourceFile || file === options.sourceFile)
      .sort();

    const results = [];
    for (const fileName of pdfFiles) {
      results.push(await this.importSource(fileName, options));
    }

    await this.seedDoctrine();
    return {
      sourceCount: results.length,
      sources: results,
    };
  }

  async cleanupUnclearTradeCases(sourceFile?: string) {
    return this.prisma.almanacTradeCase.deleteMany({
      where: {
        label: AlmanacTradeLabel.UNCLEAR,
        ...(sourceFile ? { source: { pdfFileName: sourceFile } } : {}),
      },
    });
  }

  async getExplorer(filters: AlmanacFilters = {}) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 1500);
    const tradeWhere = this.buildTradeCaseWhere(filters);
    const reportWhere = this.buildReportWhere(filters);
    const doctrineWhere = this.buildDoctrineWhere(filters);

    const [
      sources,
      sourceCount,
      reportCount,
      chartCount,
      tradeCaseCount,
      doctrineCount,
      tradeCases,
      reports,
      doctrines,
      setupGroups,
      tickerGroups,
    ] = await Promise.all([
      this.prisma.almanacSource.findMany({
        orderBy: [{ year: 'asc' }, { quarter: 'asc' }, { pdfFileName: 'asc' }],
      }),
      this.prisma.almanacSource.count(),
      this.prisma.almanacReport.count(),
      this.prisma.almanacChart.count(),
      this.prisma.almanacTradeCase.count({ where: tradeWhere }),
      this.prisma.almanacDoctrine.count({ where: doctrineWhere }),
      this.prisma.almanacTradeCase.findMany({
        where: tradeWhere,
        orderBy: [{ sourcePage: 'asc' }, { ticker: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          source: true,
          report: true,
          chart: true,
        },
      }),
      this.prisma.almanacReport.findMany({
        where: reportWhere,
        orderBy: [{ reportDate: 'asc' }, { pageStart: 'asc' }],
        take: 250,
        include: {
          source: true,
          _count: { select: { charts: true, tradeCases: true, doctrines: true } },
        },
      }),
      this.prisma.almanacDoctrine.findMany({
        where: doctrineWhere,
        orderBy: [{ createdAt: 'asc' }],
        take: 60,
        include: {
          source: true,
          report: true,
        },
      }),
      this.prisma.almanacTradeCase.groupBy({
        by: ['setupTag'],
        where: { setupTag: { notIn: EXCLUDED_DAILY_SETUP_TAGS } },
        _count: { _all: true },
        orderBy: { _count: { setupTag: 'desc' } },
        take: 25,
      }),
      this.prisma.almanacTradeCase.groupBy({
        by: ['ticker'],
        where: { setupTag: { notIn: EXCLUDED_DAILY_SETUP_TAGS } },
        _count: { _all: true },
        orderBy: { _count: { ticker: 'desc' } },
        take: 25,
      }),
    ]);

    return {
      summary: {
        sourceCount,
        reportCount,
        chartCount,
        tradeCaseCount,
        doctrineCount,
      },
      sources,
      reports,
      doctrines,
      tradeCases,
      facets: {
        setupTags: setupGroups.map((item) => ({
          value: item.setupTag,
          count: item._count._all,
        })),
        tickers: tickerGroups.map((item) => ({
          value: item.ticker,
          count: item._count._all,
        })),
        setupTaxonomy: SETUP_RULES.map((rule) => rule.tag),
        catalystTags: CATALYST_RULES.map((rule) => rule.tag),
        mindsetTags: MINDSET_RULES.map((rule) => rule.tag),
      },
      page,
      limit,
      total: tradeCaseCount,
    };
  }

  async updateTradeCase(
    id: string,
    input: {
      label?: AlmanacTradeLabel;
      reviewNotes?: string | null;
      phase?: AlmanacSetupPhase;
      direction?: Direction | null;
      ticker?: string;
      setupTag?: string;
      chartId?: string | null;
    },
  ) {
    const ticker = input.ticker?.trim().toUpperCase();
    const setupTag = input.setupTag?.trim();
    return this.prisma.almanacTradeCase.update({
      where: { id },
      data: {
        ...(ticker ? { ticker } : {}),
        ...(setupTag ? { setupTag } : {}),
        ...(input.label ? { label: input.label } : {}),
        ...(input.phase ? { phase: input.phase } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.chartId !== undefined ? { chartId: input.chartId } : {}),
        ...(input.reviewNotes !== undefined
          ? { reviewNotes: input.reviewNotes }
          : {}),
      },
      include: { source: true, report: true, chart: true },
    });
  }

  async getTradeCaseOhlcv(id: string): Promise<AlmanacOhlcvResponse> {
    const tradeCase = await this.prisma.almanacTradeCase.findUnique({
      where: { id },
      include: { report: true },
    });

    if (!tradeCase) {
      throw new Error(`Almanac trade case not found: ${id}`);
    }

    const ticker = tradeCase.ticker.trim().toUpperCase();
    const validTicker = /^[A-Z][A-Z0-9-]{0,9}$/.test(ticker);
    if (!validTicker) {
      return this.emptyOhlcvResponse(
        id,
        ticker,
        'INVALID_TICKER',
        'Correct the extracted ticker before recreating the OHLCV chart.',
        tradeCase.report?.reportDate ?? tradeCase.timeframeStart ?? tradeCase.timeframeEnd,
      );
    }

    const reportDate = tradeCase.report?.reportDate ?? tradeCase.timeframeStart ?? tradeCase.timeframeEnd;
    if (!reportDate) {
      return this.emptyOhlcvResponse(
        id,
        ticker,
        'MISSING',
        'No report date is available for this case.',
        null,
      );
    }

    const { windowStart, windowEnd, calcStart } = buildOhlcvWindow(
      tradeCase.timeframeEnd ?? reportDate,
    );
    const stock = await this.prisma.stock.upsert({
      where: { ticker },
      create: { ticker, name: ticker, isTradable: true, isActive: true },
      update: {},
    });

    let fetchedCount = 0;
    const existingWindowCount = await this.prisma.stockDaily.count({
      where: {
        stockId: stock.id,
        date: { gte: windowStart, lte: windowEnd },
      },
    });

    if (existingWindowCount < 40) {
      const fetched = await fetchYahooDailyBars(ticker, calcStart, windowEnd);
      fetchedCount = fetched.length;
      if (fetched.length > 0) {
        await this.prisma.stockDaily.createMany({
          data: fetched.map((bar) => ({
            stockId: stock.id,
            date: bar.date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: BigInt(Math.round(bar.volume)),
          })),
          skipDuplicates: true,
        });
      }
    }

    const bars = await this.prisma.stockDaily.findMany({
      where: {
        stockId: stock.id,
        date: { gte: calcStart, lte: windowEnd },
      },
      orderBy: { date: 'asc' },
    });

    const enriched = enrichDailyBars(
      bars.map((bar) => ({
        id: bar.id,
        stockId: bar.stockId,
        date: bar.date,
        open: Number(bar.open),
        high: Number(bar.high),
        low: Number(bar.low),
        close: Number(bar.close),
        volume: Number(bar.volume),
        sma20: bar.sma20 == null ? null : Number(bar.sma20),
        sma50: bar.sma50 == null ? null : Number(bar.sma50),
        sma150: bar.sma150 == null ? null : Number(bar.sma150),
        sma200: bar.sma200 == null ? null : Number(bar.sma200),
        ema6: bar.ema6 == null ? null : Number(bar.ema6),
        ema20: bar.ema20 == null ? null : Number(bar.ema20),
        rsRank: bar.rsRank == null ? null : Number(bar.rsRank),
        atr14: bar.atr14 == null ? null : Number(bar.atr14),
      })),
    ).filter((bar) => bar.date >= windowStart && bar.date <= windowEnd);

    const status =
      enriched.length === 0 ? 'MISSING' : fetchedCount > 0 ? 'FETCHED' : 'LOCAL';
    return {
      tradeCaseId: id,
      ticker,
      status,
      message:
        enriched.length === 0
          ? 'No OHLCV bars were found for this ticker/date window.'
          : null,
      reportDate: toDateKey(reportDate),
      windowStart: toDateKey(windowStart),
      windowEnd: toDateKey(windowEnd),
      bars: enriched.map((bar) => ({
        ...bar,
        date: toDateKey(bar.date),
      })),
    };
  }

  private emptyOhlcvResponse(
    tradeCaseId: string,
    ticker: string,
    status: AlmanacOhlcvResponse['status'],
    message: string,
    reportDate: Date | null,
  ): AlmanacOhlcvResponse {
    return {
      tradeCaseId,
      ticker,
      status,
      message,
      reportDate: reportDate ? toDateKey(reportDate) : null,
      windowStart: null,
      windowEnd: null,
      bars: [],
    };
  }

  private async importSource(fileName: string, options: AlmanacImportOptions) {
    const pdfPath = join(this.almanacRoot, fileName);
    const info = await this.readPdfInfo(pdfPath);
    const imageInfos = options.extractImages || options.linkChartsOnly
      ? await this.readChartImageInfo(pdfPath)
      : [];
    const parsedName = this.parseSourceName(fileName);
    const source = await this.prisma.almanacSource.upsert({
      where: { pdfFileName: fileName },
      create: {
        pdfFileName: fileName,
        title: info.title ?? parsedName.title,
        year: parsedName.year,
        quarter: parsedName.quarter,
        pageCount: info.pages,
        embeddedImageCount: imageInfos.length,
        pdfPath: join(ALMANAC_DIR, fileName).replace(/\\/g, '/'),
        fileSizeBytes: info.fileSizeBytes,
      },
      update: {
        title: info.title ?? parsedName.title,
        year: parsedName.year,
        quarter: parsedName.quarter,
        pageCount: info.pages,
        embeddedImageCount: imageInfos.length,
        pdfPath: join(ALMANAC_DIR, fileName).replace(/\\/g, '/'),
        fileSizeBytes: info.fileSizeBytes,
        importedAt: new Date(),
      },
    });

    const pages = await this.extractPages(pdfPath);
    const reportSlices = extractReportSlices(pages);
    const existingReportByPage = options.linkChartsOnly
      ? await this.readExistingReportByPage(source.id)
      : new Map<number, string>();
    const reportByPage =
      options.linkChartsOnly && existingReportByPage.size > 0
        ? existingReportByPage
        : await this.upsertReports(source.id, reportSlices, options);
    if (options.extractImages || options.linkChartsOnly) {
      const imagePathByNumber = options.extractImages
        ? await this.extractImages(pdfPath, fileName)
        : new Map<number, string>();
      await this.upsertCharts(source.id, imageInfos, reportByPage, pages, imagePathByNumber);
      if (options.extractImages) {
        await this.linkTradeCasesToCharts(source.id);
      }
    }

    return {
      id: source.id,
      pdfFileName: fileName,
      pageCount: info.pages,
      embeddedImageCount: imageInfos.length,
      reportCount: reportSlices.length,
    };
  }

  private async readExistingReportByPage(sourceId: string) {
    const reports = await this.prisma.almanacReport.findMany({
      where: { sourceId },
      select: { id: true, pageStart: true, pageEnd: true },
    });
    const reportByPage = new Map<number, string>();
    for (const report of reports) {
      for (let page = report.pageStart; page <= report.pageEnd; page++) {
        reportByPage.set(page, report.id);
      }
    }
    return reportByPage;
  }

  private async upsertReports(
    sourceId: string,
    reportSlices: ReportSlice[],
    options: AlmanacImportOptions,
  ): Promise<Map<number, string>> {
    const reportByPage = new Map<number, string>();
    const maxCases = options.maxTradeCasesPerReport ?? MAX_TRADE_CASES_PER_REPORT;

    for (const slice of reportSlices) {
      const reportText = slice.pages.map((page) => page.text).join('\n');
      const tickers = extractTickers(reportText);
      const setupTags = detectTags(reportText, SETUP_RULES);
      const catalystTags = detectTags(reportText, CATALYST_RULES);
      const mindsetTags = detectTags(reportText, MINDSET_RULES);

      const report = await this.prisma.almanacReport.upsert({
        where: {
          sourceId_reportDate_pageStart: {
            sourceId,
            reportDate: slice.reportDate,
            pageStart: slice.pageStart,
          },
        },
        create: {
          sourceId,
          reportDate: slice.reportDate,
          title: this.formatReportTitle(slice.reportDate),
          pageStart: slice.pageStart,
          pageEnd: slice.pageEnd,
          marketContext: this.deriveMarketContext(setupTags, catalystTags, mindsetTags),
          tickersJson: tickers,
          setupTagsJson: setupTags,
          catalystTagsJson: catalystTags,
          mindsetTagsJson: mindsetTags,
        },
        update: {
          title: this.formatReportTitle(slice.reportDate),
          pageEnd: slice.pageEnd,
          marketContext: this.deriveMarketContext(setupTags, catalystTags, mindsetTags),
          tickersJson: tickers,
          setupTagsJson: setupTags,
          catalystTagsJson: catalystTags,
          mindsetTagsJson: mindsetTags,
        },
      });

      for (let page = slice.pageStart; page <= slice.pageEnd; page++) {
        reportByPage.set(page, report.id);
      }

      const tradeCandidates = slice.pages.flatMap((page) =>
        inferTradeCandidatesFromText(page.text, page.pageNumber, maxCases, slice.reportDate),
      ).slice(0, maxCases);

      for (const candidate of tradeCandidates) {
        const uniqueWhere = {
          sourceId_sourcePage_ticker_setupTag: {
            sourceId,
            sourcePage: candidate.sourcePage,
            ticker: candidate.ticker,
            setupTag: candidate.setupTag,
          },
        };
        const existing = await this.prisma.almanacTradeCase.findUnique({
          where: uniqueWhere,
          select: { label: true },
        });

        if (!existing) {
          await this.prisma.almanacTradeCase.create({
            data: {
              sourceId,
              reportId: report.id,
              ticker: candidate.ticker,
              setupTag: candidate.setupTag,
              direction: candidate.direction,
              phase: candidate.phase,
              catalystTagsJson: candidate.catalystTags,
              mindsetTagsJson: candidate.mindsetTags,
              timeframeStart: candidate.timeframeStart ?? slice.reportDate,
              timeframeEnd: candidate.timeframeEnd ?? slice.reportDate,
              sourcePage: candidate.sourcePage,
              sourceExcerpt: candidate.sourceExcerpt,
              sourceConfidence: candidate.sourceConfidence,
            },
          });
          continue;
        }

        const isReviewed = existing.label !== AlmanacTradeLabel.UNCLEAR;
        await this.prisma.almanacTradeCase.update({
          where: {
            sourceId_sourcePage_ticker_setupTag: uniqueWhere.sourceId_sourcePage_ticker_setupTag,
          },
          data: {
            reportId: report.id,
            ...(isReviewed ? {} : { direction: candidate.direction, phase: candidate.phase }),
            catalystTagsJson: candidate.catalystTags,
            mindsetTagsJson: candidate.mindsetTags,
            timeframeStart: candidate.timeframeStart ?? slice.reportDate,
            timeframeEnd: candidate.timeframeEnd ?? slice.reportDate,
            sourceExcerpt: candidate.sourceExcerpt,
            sourceConfidence: candidate.sourceConfidence,
          },
        });
      }
    }

    return reportByPage;
  }

  private async upsertCharts(
    sourceId: string,
    imageInfos: ChartImageInfo[],
    reportByPage: Map<number, string>,
    pages: string[],
    imagePathByNumber: Map<number, string>,
  ) {
    for (const image of imageInfos) {
      const pageText = pages[image.pageNumber - 1] ?? '';
      const tickers = extractTickers(pageText);
      const setupTags = detectTags(pageText, SETUP_RULES);
      await this.prisma.almanacChart.upsert({
        where: {
          sourceId_imageNumber: {
            sourceId,
            imageNumber: image.imageNumber,
          },
        },
        create: {
          sourceId,
          reportId: reportByPage.get(image.pageNumber),
          pageNumber: image.pageNumber,
          imageNumber: image.imageNumber,
          imagePath: imagePathByNumber.get(image.imageNumber),
          chartType: image.chartType,
          width: image.width,
          height: image.height,
          inferredTicker: tickers[0],
          inferredSetupTags: setupTags,
          nearbyTextSnippet: excerptAround(pageText, tickers[0] ?? setupTags[0] ?? ''),
          sourceConfidence:
            tickers.length > 0 || setupTags.length > 0
              ? AlmanacSourceConfidence.MEDIUM
              : AlmanacSourceConfidence.LOW,
        },
        update: {
          reportId: reportByPage.get(image.pageNumber),
          imagePath: imagePathByNumber.get(image.imageNumber),
          chartType: image.chartType,
          width: image.width,
          height: image.height,
          inferredTicker: tickers[0],
          inferredSetupTags: setupTags,
          nearbyTextSnippet: excerptAround(pageText, tickers[0] ?? setupTags[0] ?? ''),
          sourceConfidence:
            tickers.length > 0 || setupTags.length > 0
              ? AlmanacSourceConfidence.MEDIUM
              : AlmanacSourceConfidence.LOW,
        },
      });
    }
  }

  private async linkTradeCasesToCharts(sourceId: string) {
    const [tradeCases, charts] = await Promise.all([
      this.prisma.almanacTradeCase.findMany({
        where: { sourceId, chartId: null },
        select: {
          id: true,
          reportId: true,
          ticker: true,
          setupTag: true,
          sourcePage: true,
        },
      }),
      this.prisma.almanacChart.findMany({
        where: { sourceId },
        select: {
          id: true,
          reportId: true,
          pageNumber: true,
          imagePath: true,
          inferredTicker: true,
          inferredSetupTags: true,
        },
      }),
    ]);

    for (const tradeCase of tradeCases) {
      let best: { chartId: string; score: number } | null = null;
      for (const chart of charts) {
        const score = this.scoreChartMatch(tradeCase, chart);
        if (score <= 0) continue;
        if (!best || score > best.score) best = { chartId: chart.id, score };
      }

      if (best) {
        await this.prisma.almanacTradeCase.update({
          where: { id: tradeCase.id },
          data: { chartId: best.chartId },
        });
      }
    }
  }

  private scoreChartMatch(
    tradeCase: {
      reportId: string | null;
      ticker: string;
      setupTag: string;
      sourcePage: number;
    },
    chart: {
      reportId: string | null;
      pageNumber: number;
      imagePath: string | null;
      inferredTicker: string | null;
      inferredSetupTags: Prisma.JsonValue | null;
    },
  ) {
    let score = chart.imagePath ? 5 : 0;
    if (tradeCase.reportId && chart.reportId === tradeCase.reportId) score += 20;

    const pageDistance = Math.abs(chart.pageNumber - tradeCase.sourcePage);
    if (pageDistance === 0) score += 40;
    else if (pageDistance === 1) score += 16;
    else if (pageDistance <= 3) score += 8;
    else if (tradeCase.reportId && chart.reportId === tradeCase.reportId) score += 3;
    else return 0;

    if (chart.inferredTicker?.toUpperCase() === tradeCase.ticker.toUpperCase()) {
      score += 30;
    }

    const setupTags = toStringArray(chart.inferredSetupTags);
    if (setupTags.includes(tradeCase.setupTag)) score += 20;

    return score;
  }

  private async seedDoctrine() {
    for (const seed of DOCTRINE_SEEDS) {
      const existing = await this.prisma.almanacDoctrine.findFirst({
        where: { title: seed.title, sourceId: null },
      });
      const data = {
        title: seed.title,
        summary: seed.summary,
        setupTagsJson: seed.setupTags,
        mindsetTagsJson: seed.mindsetTags,
        sourceConfidence: AlmanacSourceConfidence.MEDIUM,
      };
      if (existing) {
        await this.prisma.almanacDoctrine.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await this.prisma.almanacDoctrine.create({ data });
      }
    }
  }

  private async readPdfInfo(pdfPath: string): Promise<PdfInfo> {
    const { stdout } = await execFileAsync('pdfinfo.exe', [pdfPath], {
      maxBuffer: 2_000_000,
    });
    const pages = Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
    const title = stdout.match(/^Title:\s+(.+)$/m)?.[1]?.trim();
    const fileSizeRaw = stdout.match(/^File size:\s+(\d+)/m)?.[1];
    return {
      title,
      pages,
      fileSizeBytes: fileSizeRaw
        ? BigInt(fileSizeRaw)
        : BigInt(statSync(pdfPath).size),
    };
  }

  private async extractPages(pdfPath: string): Promise<string[]> {
    const { stdout } = await execFileAsync('pdftotext.exe', ['-layout', pdfPath, '-'], {
      maxBuffer: 200_000_000,
    });
    return stdout.split('\f').map((page) => page.trim());
  }

  private async readChartImageInfo(pdfPath: string): Promise<ChartImageInfo[]> {
    const { stdout } = await execFileAsync('pdfimages.exe', ['-list', pdfPath], {
      maxBuffer: 30_000_000,
    });
    return stdout
      .split(/\r?\n/)
      .slice(2)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/);
        return {
          pageNumber: Number(parts[0]),
          imageNumber: Number(parts[1]),
          chartType: parts[2],
          width: Number(parts[3]) || undefined,
          height: Number(parts[4]) || undefined,
        };
      })
      .filter((item) => Number.isFinite(item.pageNumber) && Number.isFinite(item.imageNumber));
  }

  private async extractImages(
    pdfPath: string,
    fileName: string,
  ): Promise<Map<number, string>> {
    const sourceSlug = basename(fileName, '.pdf').replace(/[^a-zA-Z0-9_-]/g, '_');
    const outputDir = join(this.artifactRoot, sourceSlug);
    mkdirSync(outputDir, { recursive: true });
    const prefix = join(outputDir, 'chart');
    await execFileAsync('pdfimages.exe', ['-png', pdfPath, prefix], {
      maxBuffer: 30_000_000,
    });
    const files = readdirSync(outputDir)
      .filter((file) => /^chart-\d+\.(png|jpg|ppm)$/i.test(file))
      .sort();
    return new Map(
      files.map((file, index) => [
        index,
        join(ARTIFACT_DIR, sourceSlug, file).replace(/\\/g, '/'),
      ]),
    );
  }

  private buildTradeCaseWhere(filters: AlmanacFilters): Prisma.AlmanacTradeCaseWhereInput {
    const where: Prisma.AlmanacTradeCaseWhereInput = {
      setupTag: { notIn: EXCLUDED_DAILY_SETUP_TAGS },
    };
    if (filters.ticker) where.ticker = filters.ticker.toUpperCase();
    if (filters.setupTag) {
      where.setupTag = EXCLUDED_DAILY_SETUP_TAGS.includes(filters.setupTag)
        ? { equals: '__NO_DAILY_SETUP__' }
        : filters.setupTag;
    }
    if (filters.label) where.label = filters.label;
    if (filters.year || filters.quarter) {
      where.source = {
        ...(filters.year ? { year: filters.year } : {}),
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
      };
    }
    if (filters.catalystTag) {
      where.catalystTagsJson = { array_contains: [filters.catalystTag] };
    }
    if (filters.mindsetTag) {
      where.mindsetTagsJson = { array_contains: [filters.mindsetTag] };
    }
    if (filters.q) {
      where.OR = [
        { ticker: { contains: filters.q, mode: 'insensitive' } },
        { setupTag: { contains: filters.q, mode: 'insensitive' } },
        { sourceExcerpt: { contains: filters.q, mode: 'insensitive' } },
        { reviewNotes: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private buildReportWhere(filters: AlmanacFilters): Prisma.AlmanacReportWhereInput {
    const where: Prisma.AlmanacReportWhereInput = {};
    if (filters.year || filters.quarter) {
      where.source = {
        ...(filters.year ? { year: filters.year } : {}),
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
      };
    }
    if (filters.setupTag) where.setupTagsJson = { array_contains: [filters.setupTag] };
    if (filters.catalystTag) where.catalystTagsJson = { array_contains: [filters.catalystTag] };
    if (filters.mindsetTag) where.mindsetTagsJson = { array_contains: [filters.mindsetTag] };
    return where;
  }

  private buildDoctrineWhere(filters: AlmanacFilters): Prisma.AlmanacDoctrineWhereInput {
    const where: Prisma.AlmanacDoctrineWhereInput = {};
    if (filters.setupTag) where.setupTagsJson = { array_contains: [filters.setupTag] };
    if (filters.catalystTag) where.catalystTagsJson = { array_contains: [filters.catalystTag] };
    if (filters.mindsetTag) where.mindsetTagsJson = { array_contains: [filters.mindsetTag] };
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { summary: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private parseSourceName(fileName: string) {
    const match = fileName.match(/(?:Almanac_)?(\d{4})_Q([1-4])/i);
    const year = match ? Number(match[1]) : undefined;
    const quarter = match ? Number(match[2]) : undefined;
    return {
      year,
      quarter,
      title: year && quarter ? `Gilmo Almanac ${year} Q${quarter}` : fileName,
    };
  }

  private formatReportTitle(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  }

  private deriveMarketContext(
    setupTags: string[],
    catalystTags: string[],
    mindsetTags: string[],
  ): string {
    const parts = [
      setupTags.length ? `Setups: ${setupTags.slice(0, 5).join(', ')}` : null,
      catalystTags.length ? `Catalysts: ${catalystTags.slice(0, 4).join(', ')}` : null,
      mindsetTags.length ? `Mindset: ${mindsetTags.slice(0, 4).join(', ')}` : null,
    ].filter(Boolean);
    return parts.join(' | ') || 'Report indexed; review needed for setup context.';
  }

  private resolveRepoRoot(): string {
    const cwd = resolve(process.cwd());
    if (existsSync(join(cwd, ALMANAC_DIR))) return cwd;
    const parent = resolve(cwd, '..');
    if (existsSync(join(parent, ALMANAC_DIR))) return parent;
    return cwd;
  }
}

function toStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function buildOhlcvWindow(anchorDate: Date) {
  const windowEnd = addDays(anchorDate, 0);
  const windowStart = addDays(windowEnd, -270);
  const calcStart = addDays(windowStart, -260);
  return { windowStart, windowEnd, calcStart };
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function roundNullable(value: number | null): number | null {
  return value == null ? null : Math.round(value * 10000) / 10000;
}

function simpleMovingAverage(values: number[], index: number, period: number): number | null {
  if (index + 1 < period) return null;
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += values[i];
  }
  return sum / period;
}

function computeEma(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = [];
  if (values.length === 0) return output;
  const multiplier = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < period) {
      output.push(null);
      continue;
    }
    if (ema == null) {
      ema = simpleMovingAverage(values, i, period);
    } else {
      ema = values[i] * multiplier + ema * (1 - multiplier);
    }
    output.push(ema);
  }
  return output;
}

function enrichDailyBars<T extends {
  close: number;
  sma20: number | null;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  ema6: number | null;
  ema20: number | null;
}>(bars: T[]): T[] {
  const closes = bars.map((bar) => bar.close);
  const ema6 = computeEma(closes, 6);
  const ema20 = computeEma(closes, 20);
  return bars.map((bar, index) => ({
    ...bar,
    sma20: roundNullable(bar.sma20 ?? simpleMovingAverage(closes, index, 20)),
    sma50: roundNullable(bar.sma50 ?? simpleMovingAverage(closes, index, 50)),
    sma150: roundNullable(bar.sma150 ?? simpleMovingAverage(closes, index, 150)),
    sma200: roundNullable(bar.sma200 ?? simpleMovingAverage(closes, index, 200)),
    ema6: roundNullable(bar.ema6 ?? ema6[index]),
    ema20: roundNullable(bar.ema20 ?? ema20[index]),
  }));
}

async function fetchYahooDailyBars(ticker: string, from: Date, to: Date) {
  try {
    const yahoo = await import('yahoo-finance2');
    const YahooFinanceCtor = yahoo.default;
    const client = new YahooFinanceCtor({
      suppressNotices: ['ripHistorical'],
    });
    const result = await client.historical(ticker, {
      period1: from,
      period2: to,
      interval: '1d',
    });
    return result.map((row) => ({
      date: row.date,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    }));
  } catch {
    return [];
  }
}
