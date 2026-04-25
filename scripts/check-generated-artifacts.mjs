import { execSync } from 'node:child_process'

const status = execSync('git status --porcelain', { encoding: 'utf8' })
const lines = status
  .split('\n')
  .map((line) => line.trimEnd())
  .filter(Boolean)

const entries = lines.map((line) => {
  const statusCode = line.slice(0, 2)
  const filePath = (line.slice(3).split(' -> ').pop() ?? '').replace(/\\/g, '/')
  return { statusCode, filePath }
})

const blocked = entries
  .filter(({ statusCode }) => {
    const trimmed = statusCode.trim()
    return trimmed !== 'D' && trimmed !== 'DD'
  })
  .map(({ filePath }) => filePath)
  .filter(
    (filePath) =>
      /(^|\/)dist\//.test(filePath) ||
      filePath.endsWith('.tsbuildinfo') ||
      filePath.includes('/.tmp/tsconfig.'),
  )

if (blocked.length > 0) {
  console.error('Generated artifacts detected in git status:')
  for (const filePath of blocked) {
    console.error(`- ${filePath}`)
  }
  console.error(
    '\nPolicy: keep generated outputs out of commits. Remove these changes or untrack them first.',
  )
  process.exit(1)
}

console.log('No generated artifact changes detected.')
