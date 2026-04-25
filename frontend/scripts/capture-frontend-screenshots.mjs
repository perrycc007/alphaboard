import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoDir = path.resolve(scriptDir, '..', '..')
const backendDir = path.join(repoDir, 'backend')
const frontendDir = path.join(repoDir, 'frontend')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const screenshotDir = path.join(repoDir, 'artifacts', `frontend-screenshots-${stamp}`)
const frontendPort = 3901
const frontendUrl = `http://127.0.0.1:${frontendPort}`
const backendProbeUrl = 'http://127.0.0.1:3000'

let backendProc = null
let frontendProc = null
let backendStartedByScript = false
let frontendStartedByScript = false

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function canReach(url) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return Boolean(res)
  } catch {
    return false
  }
}

function startProcess(name, cwd, command) {
  const child = spawn('cmd.exe', ['/c', command], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk.toString()}`)
  })

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk.toString()}`)
  })

  return child
}

async function waitForUrl(url, timeoutMs = 90000, intervalMs = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await canReach(url)) return true
    await delay(intervalMs)
  }
  return false
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return
  spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
    stdio: 'ignore',
  })
}

async function clickButton(page, name) {
  const button = page.getByRole('button', { name }).first()
  if ((await button.count()) === 0) return false

  try {
    await button.click({ timeout: 2000 })
    await page.waitForTimeout(800)
    return true
  } catch {
    return false
  }
}

async function clickLocator(locator) {
  if ((await locator.count()) === 0) return false
  try {
    await locator.first().click({ timeout: 2000 })
    await locator.page().waitForTimeout(800)
    return true
  } catch {
    return false
  }
}

async function gotoRoute(page, route) {
  await page.goto(`${frontendUrl}${route}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(1500)
}

async function run() {
  await ensureDir(screenshotDir)

  if (!(await canReach(backendProbeUrl))) {
    backendProc = startProcess('backend', backendDir, 'npm.cmd run start')
    backendStartedByScript = true
    await waitForUrl(backendProbeUrl, 120000)
  }

  frontendProc = startProcess(
    'frontend',
    frontendDir,
    `npm.cmd run dev -- --host 127.0.0.1 --port ${frontendPort}`,
  )
  frontendStartedByScript = true
  const frontendReady = await waitForUrl(frontendUrl, 120000)
  if (!frontendReady) {
    throw new Error(`Frontend did not start on ${frontendUrl}`)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  })
  const page = await context.newPage()

  const screenshots = []
  const pageErrors = []
  let shotIndex = 1

  page.on('pageerror', (err) => {
    pageErrors.push(`pageerror: ${err.message}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      pageErrors.push(`console(${msg.type()}): ${msg.text()}`)
    }
  })

  async function snap(name) {
    const fileName = `${String(shotIndex).padStart(2, '0')}-${name}.png`
    shotIndex += 1
    await page.screenshot({
      path: path.join(screenshotDir, fileName),
      fullPage: true,
    })
    screenshots.push(fileName)
    process.stdout.write(`Saved ${fileName}\n`)
  }

  await gotoRoute(page, '/')
  const appMarker = page.getByText('Alphaboard').first()
  if ((await appMarker.count()) === 0) {
    throw new Error(`Loaded unexpected app at ${frontendUrl}; Alphaboard marker not found`)
  }
  await snap('dashboard')
  if (await clickButton(page, 'Collapse sidebar')) {
    await snap('dashboard-sidebar-collapsed')
    await clickButton(page, 'Expand sidebar')
  }

  await gotoRoute(page, '/themes')
  await snap('themes')
  const themeRow = page.locator('button:has(h3)').first()
  if (await clickLocator(themeRow)) {
    await snap('themes-expanded')
  }

  await gotoRoute(page, '/watchlist')
  await snap('watchlist')
  if (await clickButton(page, 'Suggested Trades')) {
    await snap('watchlist-tab-suggested-trades')
  }
  if (await clickButton(page, 'Active Positions')) {
    await snap('watchlist-tab-active-positions')
  }
  const watchCard = page.getByRole('button', { name: /NVDA/i }).first()
  if (await clickLocator(watchCard)) {
    const panel = page.getByRole('dialog')
    if ((await panel.count()) > 0) {
      await panel.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
      await snap('watchlist-stock-detail-panel')
      await clickButton(page, 'Close panel')
    }
  }

  await gotoRoute(page, '/screener')
  await snap('screener')
  if (await clickButton(page, 'Previous Leaders')) {
    await snap('screener-tab-previous-leaders')
  }
  if (await clickButton(page, 'Commodity')) {
    await snap('screener-tab-commodity')
  }
  if (await clickButton(page, 'High Tight Flag')) {
    await snap('screener-tab-high-tight-flag')
  }

  await gotoRoute(page, '/journal')
  await snap('journal')
  if (await clickButton(page, 'Personal Stats')) {
    await snap('journal-tab-personal-stats')
  }
  if (await clickButton(page, 'System Stats')) {
    await snap('journal-tab-system-stats')
  }

  await gotoRoute(page, '/playbook')
  await snap('playbook')
  if (await clickButton(page, 'Filter')) {
    await snap('playbook-filter-open')
  }

  await gotoRoute(page, '/simulate')
  await snap('simulate')
  const tickerInput = page.getByPlaceholder('Enter ticker (e.g., AAPL, NVDA, TSLA)...')
  if ((await tickerInput.count()) > 0) {
    await tickerInput.fill('NVDA')
    if (await clickButton(page, 'Simulate')) {
      await page.waitForTimeout(5000)
      await snap('simulate-after-run')
    }
  }

  await gotoRoute(page, '/regimes')
  await snap('regimes')

  await gotoRoute(page, '/label')
  await snap('label')
  if (await clickButton(page, 'Wrong Type')) {
    await snap('label-wrong-type-menu')
  }

  await gotoRoute(page, '/settings')
  await snap('settings')

  await browser.close()

  const uniqueErrors = [...new Set(pageErrors)]
  await fs.writeFile(
    path.join(screenshotDir, 'manifest.json'),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        screenshotDir,
        screenshots,
        pageErrors: uniqueErrors,
      },
      null,
      2,
    ),
    'utf8',
  )

  process.stdout.write(`\nScreenshots saved to: ${screenshotDir}\n`)
}

try {
  await run()
} finally {
  if (frontendStartedByScript) stopProcessTree(frontendProc)
  if (backendStartedByScript) stopProcessTree(backendProc)
}
