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
const MAX_EXCERPT_CHARS = 260;
const MAX_TRADE_CASES_PER_REPORT = 18;

const REPORT_DATE_RE =
  /(?:^|\n)(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g;
const COMPANY_TICKER_RE = /\(([A-Z][A-Z0-9.$-]{0,7})\)/g;
const BARE_TICKER_RE = /\b[A-Z][A-Z0-9.$-]{1,5}\b/g;

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
    tag: '620_TIMING',
    phrases: ['620-chart', '620 chart', 'five-minute 620'],
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
  }> = [];
  const catalystTags = detectTags(text, CATALYST_RULES);
  const mindsetTags = detectTags(text, MINDSET_RULES);

  for (const rule of SETUP_RULES) {
    const phrase = rule.phrases.find((item) =>
      text.toLowerCase().includes(item.toLowerCase()),
    );
    if (!phrase) continue;

    for (const ticker of tickers.slice(0, 4)) {
      candidates.push({
        ticker,
        setupTag: rule.tag,
        direction: inferDirection(rule, text),
        phase: rule.phase,
        catalystTags,
        mindsetTags,
        sourcePage: pageNumber,
        sourceExcerpt: excerptAround(text, phrase),
        sourceConfidence: text.includes(`(${ticker})`)
          ? AlmanacSourceConfidence.MEDIUM
          : AlmanacSourceConfidence.LOW,
      });
      if (candidates.length >= maxCases) return candidates;
    }
  }

  return candidates;
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

  async getExplorer(filters: AlmanacFilters = {}) {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
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
        take: 60,
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
        _count: { _all: true },
        orderBy: { _count: { setupTag: 'desc' } },
        take: 25,
      }),
      this.prisma.almanacTradeCase.groupBy({
        by: ['ticker'],
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
    },
  ) {
    return this.prisma.almanacTradeCase.update({
      where: { id },
      data: {
        ...(input.label ? { label: input.label } : {}),
        ...(input.phase ? { phase: input.phase } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.reviewNotes !== undefined
          ? { reviewNotes: input.reviewNotes }
          : {}),
      },
      include: { source: true, report: true, chart: true },
    });
  }

  private async importSource(fileName: string, options: AlmanacImportOptions) {
    const pdfPath = join(this.almanacRoot, fileName);
    const info = await this.readPdfInfo(pdfPath);
    const imageInfos = await this.readChartImageInfo(pdfPath);
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
    const reportByPage = await this.upsertReports(source.id, reportSlices, options);
    const imagePathByNumber = options.extractImages
      ? await this.extractImages(pdfPath, fileName)
      : new Map<number, string>();
    await this.upsertCharts(source.id, imageInfos, reportByPage, pages, imagePathByNumber);

    return {
      id: source.id,
      pdfFileName: fileName,
      pageCount: info.pages,
      embeddedImageCount: imageInfos.length,
      reportCount: reportSlices.length,
    };
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
        inferTradeCandidatesFromText(page.text, page.pageNumber, maxCases),
      ).slice(0, maxCases);

      for (const candidate of tradeCandidates) {
        await this.prisma.almanacTradeCase.upsert({
          where: {
            sourceId_sourcePage_ticker_setupTag: {
              sourceId,
              sourcePage: candidate.sourcePage,
              ticker: candidate.ticker,
              setupTag: candidate.setupTag,
            },
          },
          create: {
            sourceId,
            reportId: report.id,
            ticker: candidate.ticker,
            setupTag: candidate.setupTag,
            direction: candidate.direction,
            phase: candidate.phase,
            catalystTagsJson: candidate.catalystTags,
            mindsetTagsJson: candidate.mindsetTags,
            timeframeStart: slice.reportDate,
            timeframeEnd: slice.reportDate,
            sourcePage: candidate.sourcePage,
            sourceExcerpt: candidate.sourceExcerpt,
            sourceConfidence: candidate.sourceConfidence,
          },
          update: {
            reportId: report.id,
            direction: candidate.direction,
            phase: candidate.phase,
            catalystTagsJson: candidate.catalystTags,
            mindsetTagsJson: candidate.mindsetTags,
            timeframeStart: slice.reportDate,
            timeframeEnd: slice.reportDate,
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
    const where: Prisma.AlmanacTradeCaseWhereInput = {};
    if (filters.ticker) where.ticker = filters.ticker.toUpperCase();
    if (filters.setupTag) where.setupTag = filters.setupTag;
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
