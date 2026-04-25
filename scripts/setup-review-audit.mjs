import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const artifactsRoot = path.join(repoRoot, 'artifacts', 'setup_review')

const DETECTOR_MAP = {
  TREND_LONG_20EMA_PULLBACK: {
    detectorId: 'EMA20_PULLBACK',
    detectorSource: 'backend/src/modules/setup/detectors/daily/ema20-pullback.detector.ts',
  },
  TREND_LONG_20EMA_LEGACY: {
    detectorId: 'EMA20_PULLBACK_LEGACY',
    detectorSource: null,
  },
  BASE_FAILURE_SHORT: {
    detectorId: 'FAIL_BASE',
    detectorSource: 'backend/src/modules/setup/detectors/daily/fail-base.detector.ts',
  },
  TREND_SHORT_20EMA_RALLY: {
    detectorId: 'MA_RALLY_FAILURE',
    detectorSource: 'backend/src/modules/setup/detectors/daily/ma-rally-failure.detector.ts',
  },
  BASE_REGION: {
    detectorId: 'BREAKOUT_PIVOT',
    detectorSource: 'backend/src/modules/setup/detectors/daily/daily-base.detector.ts',
  },
  DOUBLE_TOP: {
    detectorId: 'DOUBLE_TOP',
    detectorSource: 'backend/src/modules/setup/detectors/daily/double-top.detector.ts',
  },
  DOUBLE_BOTTOM: {
    detectorId: 'DOUBLE_BOTTOM',
    detectorSource: null,
  },
}

const LABEL_TO_OUTCOME = {
  yes: 'valid',
  no: 'false_positive',
  wrong_type: 'false_positive',
  unsure: 'unclear',
}

function parseArgs(argv) {
  const parsed = {}
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i]
    if (!current.startsWith('--')) continue
    const [rawKey, inlineValue] = current.slice(2).split('=')
    const next = inlineValue ?? argv[i + 1]
    const value =
      inlineValue != null || next == null || next.startsWith('--') ? inlineValue ?? true : next
    parsed[rawKey] = value
    if (inlineValue == null && value !== true) i += 1
  }
  return parsed
}

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf8').trim()
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonLines(filePath, rows) {
  ensureDir(path.dirname(filePath))
  const payload = rows.map((row) => JSON.stringify(row)).join('\n')
  fs.writeFileSync(filePath, `${payload}\n`)
}

function normalizePathForFs(relativePath) {
  return relativePath.replaceAll('\\', path.sep).replaceAll('/', path.sep)
}

function toIsoDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function computeDuplicateRuns(manifest) {
  const byKey = new Map()
  for (const entry of manifest) {
    const key = `${entry.ticker}::${entry.setup_type}`
    const rows = byKey.get(key) ?? []
    rows.push(entry)
    byKey.set(key, rows)
  }

  const runInfo = new Map()
  for (const entries of byKey.values()) {
    const sorted = [...entries].sort((left, right) =>
      String(left.alert_date).localeCompare(String(right.alert_date)),
    )

    let runStart = 0
    let runNumber = 1
    for (let index = 0; index <= sorted.length; index += 1) {
      const current = sorted[index]
      const previous = sorted[index - 1]
      const shouldCloseRun =
        index === sorted.length ||
        (() => {
          if (!current || !previous) return false
          const prevDate = new Date(previous.alert_date)
          const currentDate = new Date(current.alert_date)
          if (Number.isNaN(prevDate.getTime()) || Number.isNaN(currentDate.getTime())) {
            return true
          }
          return diffDays(prevDate, currentDate) > 4
        })()

      if (!shouldCloseRun) continue

      const runEntries = sorted.slice(runStart, index)
      const runLength = runEntries.length
      for (let runIndex = 0; runIndex < runEntries.length; runIndex += 1) {
        const entry = runEntries[runIndex]
        const prev = runIndex > 0 ? runEntries[runIndex - 1] : null
        const next = runIndex < runEntries.length - 1 ? runEntries[runIndex + 1] : null
        runInfo.set(entry.chart_id, {
          duplicate_run_id: `${entry.ticker}-${entry.setup_type}-${runNumber}`,
          duplicate_run_length: runLength,
          duplicate_run_index: runIndex + 1,
          duplicate_alert: runLength > 1,
          prev_alert_gap_days: prev ? diffDays(new Date(prev.alert_date), new Date(entry.alert_date)) : null,
          next_alert_gap_days: next ? diffDays(new Date(entry.alert_date), new Date(next.alert_date)) : null,
        })
      }

      runStart = index
      runNumber += 1
    }
  }

  return runInfo
}

function collectReasonTags({ label, duplicateInfo, hasPng, hasHtml }) {
  const tags = new Set(Array.isArray(label?.reason_tags) ? label.reason_tags : [])

  if (!hasPng || !hasHtml) tags.add('annotation_or_render_issue')
  if (duplicateInfo?.duplicate_alert) tags.add('duplicate_alert')

  if (label?.human_label === 'wrong_type') tags.add('wrong_type')
  if (label?.human_label === 'no' && tags.size === 0) tags.add('needs_manual_triage')
  if (label?.human_label === 'unsure') tags.add('unclear')

  return [...tags].sort()
}

function buildTypeSummary(records) {
  const byType = new Map()
  for (const record of records) {
    const current =
      byType.get(record.setup_type) ?? {
        setup_type: record.setup_type,
        detector_id: record.detector_id,
        detector_source: record.detector_source,
        total: 0,
        labeled: 0,
        valid: 0,
        false_positive: 0,
        unclear: 0,
        missing_png: 0,
        missing_html: 0,
        duplicate_alerts: 0,
        common_reason_tags: {},
      }

    current.total += 1
    if (record.has_label) {
      current.labeled += 1
      current[record.review_outcome] += 1
    }
    if (!record.has_png) current.missing_png += 1
    if (!record.has_html) current.missing_html += 1
    if (record.duplicate_alert) current.duplicate_alerts += 1

    for (const tag of record.reason_tags) {
      current.common_reason_tags[tag] = (current.common_reason_tags[tag] ?? 0) + 1
    }

    byType.set(record.setup_type, current)
  }

  return [...byType.values()]
    .map((entry) => ({
      ...entry,
      labeled_precision:
        entry.labeled > 0 ? Number((entry.valid / entry.labeled).toFixed(4)) : null,
      duplicate_density:
        entry.total > 0 ? Number((entry.duplicate_alerts / entry.total).toFixed(4)) : 0,
      common_reason_tags: Object.entries(entry.common_reason_tags)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count })),
    }))
    .sort((left, right) => right.total - left.total || left.setup_type.localeCompare(right.setup_type))
}

function renderSummaryMarkdown(summary) {
  const lines = [
    `# Setup Review Audit: ${summary.version} (${summary.round})`,
    '',
    `- Manifest entries: ${summary.total}`,
    `- Labeled: ${summary.labeled}`,
    `- Valid labels: ${summary.valid}`,
    `- False positives: ${summary.false_positive}`,
    `- Unclear: ${summary.unclear}`,
    `- Missing PNG: ${summary.missing_png}`,
    `- Missing HTML: ${summary.missing_html}`,
    '',
    '| Setup Type | Total | Labeled | Precision | Duplicate Density | Missing PNG | Detector |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ]

  for (const item of summary.by_type) {
    lines.push(
      `| ${item.setup_type} | ${item.total} | ${item.labeled} | ${
        item.labeled_precision == null ? 'n/a' : item.labeled_precision
      } | ${item.duplicate_density} | ${item.missing_png} | ${item.detector_id ?? 'unmapped'} |`,
    )
  }

  lines.push('', '## Notes', '')
  for (const item of summary.by_type) {
    const reasons =
      item.common_reason_tags.length > 0
        ? item.common_reason_tags.map((reason) => `${reason.tag} (${reason.count})`).join(', ')
        : 'none'
    lines.push(`- ${item.setup_type}: ${reasons}`)
  }

  return `${lines.join('\n')}\n`
}

const args = parseArgs(process.argv.slice(2))
const version = String(args.version ?? 'v1')
const round = String(args.round ?? 'baseline')
const versionRoot = path.join(artifactsRoot, version)
const outputDir = path.resolve(
  String(args.outputDir ?? path.join(artifactsRoot, 'analysis', version, round)),
)

const manifest = readJsonArray(path.join(versionRoot, 'manifest.json'))
const labels = readJsonArray(path.join(versionRoot, 'labels.json'))
const setupFeedback = readJsonArray(path.join(artifactsRoot, 'logs', 'setup-feedback.json'))
const labelMap = new Map(labels.map((label) => [label.chart_id, label]))
const duplicateRuns = computeDuplicateRuns(manifest)

const reviewRecords = manifest.map((entry) => {
  const label = labelMap.get(entry.chart_id) ?? null
  const duplicateInfo =
    duplicateRuns.get(entry.chart_id) ?? {
      duplicate_run_id: null,
      duplicate_run_length: 1,
      duplicate_run_index: 1,
      duplicate_alert: false,
      prev_alert_gap_days: null,
      next_alert_gap_days: null,
    }

  const chartFsPath = normalizePathForFs(entry.chart_path)
  const htmlPath = path.join(versionRoot, chartFsPath)
  const pngPath = htmlPath.replace(/\.html$/i, '.png')
  const hasHtml = fs.existsSync(htmlPath)
  const hasPng = fs.existsSync(pngPath)
  const detector = DETECTOR_MAP[entry.setup_type] ?? { detectorId: null, detectorSource: null }
  const reviewOutcome = label?.review_outcome ?? LABEL_TO_OUTCOME[label?.human_label] ?? null
  const reasonTags = collectReasonTags({ label, duplicateInfo, hasPng, hasHtml })

  return {
    chart_id: entry.chart_id,
    ticker: entry.ticker,
    setup_type: entry.setup_type,
    detector_id: detector.detectorId,
    detector_source: detector.detectorSource,
    alert_date: toIsoDate(entry.alert_date),
    alert_price: entry.alert_price,
    window_start: toIsoDate(entry.window_start),
    window_end: toIsoDate(entry.window_end),
    rule_version: entry.rule_version,
    direction: entry.direction ?? null,
    chart_path: entry.chart_path,
    has_html: hasHtml,
    has_png: hasPng,
    render_status: hasHtml && hasPng ? 'ready' : hasHtml ? 'missing_png' : 'missing_html',
    has_label: Boolean(label),
    human_label: label?.human_label ?? null,
    review_outcome: reviewOutcome,
    reason_tags: reasonTags,
    notes: label?.notes ?? null,
    reviewer: label?.reviewer ?? null,
    review_source: label?.source ?? null,
    duplicate_run_id: duplicateInfo.duplicate_run_id,
    duplicate_run_length: duplicateInfo.duplicate_run_length,
    duplicate_run_index: duplicateInfo.duplicate_run_index,
    duplicate_alert: duplicateInfo.duplicate_alert,
    prev_alert_gap_days: duplicateInfo.prev_alert_gap_days,
    next_alert_gap_days: duplicateInfo.next_alert_gap_days,
  }
})

const byType = buildTypeSummary(reviewRecords)
const summary = {
  version,
  round,
  generated_at: new Date().toISOString(),
  total: reviewRecords.length,
  labeled: reviewRecords.filter((record) => record.has_label).length,
  valid: reviewRecords.filter((record) => record.review_outcome === 'valid').length,
  false_positive: reviewRecords.filter((record) => record.review_outcome === 'false_positive').length,
  unclear: reviewRecords.filter((record) => record.review_outcome === 'unclear').length,
  missing_png: reviewRecords.filter((record) => !record.has_png).length,
  missing_html: reviewRecords.filter((record) => !record.has_html).length,
  feedback_summary: setupFeedback.reduce((acc, row) => {
    const rating = String(row.rating ?? 'UNKNOWN')
    acc[rating] = (acc[rating] ?? 0) + 1
    return acc
  }, {}),
  by_type: byType,
}

ensureDir(outputDir)
writeJson(path.join(outputDir, 'summary.json'), summary)
writeJson(path.join(outputDir, 'review-records.json'), reviewRecords)
writeJsonLines(path.join(outputDir, 'review-records.jsonl'), reviewRecords)
fs.writeFileSync(path.join(outputDir, 'summary.md'), renderSummaryMarkdown(summary))

console.log(`Audited ${summary.total} charts for ${version}.`)
console.log(`Output written to ${outputDir}`)
