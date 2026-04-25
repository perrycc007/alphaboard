import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const artifactsRoot = path.join(repoRoot, 'artifacts', 'setup_review')

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function renderMarkdown(result) {
  const lines = [
    `# Setup Review Comparison: ${result.base.round} -> ${result.candidate.round}`,
    '',
    `- Base total: ${result.base.total}`,
    `- Candidate total: ${result.candidate.total}`,
    `- Base false positives: ${result.base.false_positive}`,
    `- Candidate false positives: ${result.candidate.false_positive}`,
    '',
    '| Setup Type | Total Delta | Precision Delta | Duplicate Density Delta |',
    '| --- | ---: | ---: | ---: |',
  ]

  for (const row of result.by_type) {
    lines.push(
      `| ${row.setup_type} | ${row.total_delta} | ${row.labeled_precision_delta ?? 'n/a'} | ${row.duplicate_density_delta ?? 'n/a'} |`,
    )
  }

  return `${lines.join('\n')}\n`
}

const args = parseArgs(process.argv.slice(2))
const version = String(args.version ?? 'v1')
const baseRound = String(args.baseRound ?? 'baseline')
const candidateRound = String(args.candidateRound ?? 'candidate')
const basePath = path.resolve(
  String(
    args.base ??
      path.join(artifactsRoot, 'analysis', version, baseRound, 'summary.json'),
  ),
)
const candidatePath = path.resolve(
  String(
    args.candidate ??
      path.join(artifactsRoot, 'analysis', version, candidateRound, 'summary.json'),
  ),
)
const outputDir = path.resolve(
  String(args.outputDir ?? path.join(artifactsRoot, 'analysis', version, candidateRound)),
)

const base = readJson(basePath)
const candidate = readJson(candidatePath)
const baseByType = new Map(base.by_type.map((entry) => [entry.setup_type, entry]))
const candidateByType = new Map(candidate.by_type.map((entry) => [entry.setup_type, entry]))

const setupTypes = [...new Set([...baseByType.keys(), ...candidateByType.keys()])].sort((left, right) =>
  left.localeCompare(right),
)

const comparison = {
  generated_at: new Date().toISOString(),
  base: {
    version: base.version,
    round: base.round,
    total: base.total,
    false_positive: base.false_positive,
  },
  candidate: {
    version: candidate.version,
    round: candidate.round,
    total: candidate.total,
    false_positive: candidate.false_positive,
  },
  by_type: setupTypes.map((setupType) => {
    const baseEntry = baseByType.get(setupType)
    const candidateEntry = candidateByType.get(setupType)
    const precisionDelta =
      candidateEntry?.labeled_precision != null && baseEntry?.labeled_precision != null
        ? Number((candidateEntry.labeled_precision - baseEntry.labeled_precision).toFixed(4))
        : null
    const duplicateDelta =
      candidateEntry?.duplicate_density != null && baseEntry?.duplicate_density != null
        ? Number((candidateEntry.duplicate_density - baseEntry.duplicate_density).toFixed(4))
        : null

    return {
      setup_type: setupType,
      total_delta: (candidateEntry?.total ?? 0) - (baseEntry?.total ?? 0),
      labeled_precision_delta: precisionDelta,
      duplicate_density_delta: duplicateDelta,
    }
  }),
}

ensureDir(outputDir)
writeJson(path.join(outputDir, 'comparison.json'), comparison)
fs.writeFileSync(path.join(outputDir, 'comparison.md'), renderMarkdown(comparison))

console.log(`Compared ${base.round} -> ${candidate.round}`)
console.log(`Output written to ${outputDir}`)
