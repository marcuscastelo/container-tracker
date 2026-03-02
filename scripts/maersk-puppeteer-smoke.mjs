#!/usr/bin/env node

import fs, { constants as fsConstants } from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

const LINUX_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/lib/chromium/chromium',
  '/snap/bin/chromium',
]

const DARWIN_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

function outputFailure(details) {
  console.error('[maersk-smoke] FAIL')
  console.error(`[maersk-smoke] cause=${details.cause}`)
  console.error(`[maersk-smoke] message=${details.message}`)
  for (const hint of details.hints) {
    console.error(`[maersk-smoke] hint=${hint}`)
  }
  if (details.diagnostics && Object.keys(details.diagnostics).length > 0) {
    console.error(`[maersk-smoke] diagnostics=${JSON.stringify(details.diagnostics)}`)
  }
}

function isExecutable(filePath) {
  if (!fs.existsSync(filePath)) return false
  try {
    fs.accessSync(filePath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

function normalizeEnvPath(variableName) {
  const value = process.env[variableName]
  if (!value) return null
  if (path.isAbsolute(value)) return value
  return path.resolve(process.cwd(), value)
}

function resolveFromEnv(variableName) {
  const resolvedPath = normalizeEnvPath(variableName)
  if (!resolvedPath) return null

  if (!isExecutable(resolvedPath)) {
    return {
      ok: false,
      error: {
        cause: 'invalid_chrome_path',
        message: `${variableName} is set but does not point to an executable browser binary.`,
        hints: [
          'Fix CHROME_PATH/CHROMIUM_PATH to a valid executable path (devcontainer default: /usr/bin/chromium).',
          'Rebuild the devcontainer if Chromium was added to Dockerfile recently.',
        ],
        diagnostics: {
          variableName,
          configuredPath: process.env[variableName] ?? null,
          resolvedPath,
          exists: fs.existsSync(resolvedPath),
        },
      },
    }
  }

  return {
    ok: true,
    executablePath: resolvedPath,
    source: variableName,
  }
}

function resolveExecutablePath() {
  const fromChromePath = resolveFromEnv('CHROME_PATH')
  if (fromChromePath) {
    return fromChromePath
  }

  const fromChromiumPath = resolveFromEnv('CHROMIUM_PATH')
  if (fromChromiumPath) {
    return fromChromiumPath
  }

  const candidates = process.platform === 'darwin' ? DARWIN_CANDIDATES : LINUX_CANDIDATES
  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return { ok: true, executablePath: candidate, source: 'system-candidate' }
    }
  }

  let puppeteerCachePath = null
  try {
    const defaultPath = puppeteer.executablePath()
    if (defaultPath) puppeteerCachePath = defaultPath
  } catch {
    puppeteerCachePath = null
  }

  if (puppeteerCachePath && isExecutable(puppeteerCachePath)) {
    return {
      ok: true,
      executablePath: puppeteerCachePath,
      source: 'puppeteer-cache',
    }
  }

  return {
    ok: false,
    error: {
      cause: 'missing_browser_binary',
      message: 'No executable Chrome/Chromium binary was found for Puppeteer launch.',
      hints: [
        'In devcontainer, ensure Chromium is installed and available at /usr/bin/chromium.',
        'Set CHROME_PATH to a valid binary path before running this smoke command.',
        'Or install Puppeteer browser cache with: pnpm exec puppeteer browsers install chrome',
      ],
      diagnostics: {
        CHROME_PATH: process.env.CHROME_PATH ?? null,
        CHROMIUM_PATH: process.env.CHROMIUM_PATH ?? null,
        checkedCandidates: candidates,
        puppeteerExpectedPath: puppeteerCachePath,
        puppeteerPathExists: puppeteerCachePath ? fs.existsSync(puppeteerCachePath) : false,
      },
    },
  }
}

async function main() {
  console.log('[maersk-smoke] Starting Puppeteer headless launch smoke check')

  const resolved = resolveExecutablePath()
  if (!resolved.ok) {
    outputFailure(resolved.error)
    process.exitCode = 1
    return
  }

  const launchOptions = {
    headless: true,
    executablePath: resolved.executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 720 },
  }

  let browser = null

  try {
    browser = await puppeteer.launch(launchOptions)
    const page = await browser.newPage()
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 15000 })
    const userAgent = await page.evaluate(() => navigator.userAgent)

    console.log('[maersk-smoke] PASS')
    console.log(`[maersk-smoke] executablePath=${resolved.executablePath}`)
    console.log(`[maersk-smoke] source=${resolved.source}`)
    console.log(`[maersk-smoke] userAgent=${userAgent}`)
  } catch (error) {
    outputFailure({
      cause: 'launch_incompatibility',
      message: error instanceof Error ? error.message : String(error),
      hints: [
        'Confirm CHROME_PATH points to a compatible Chromium/Chrome binary.',
        'If running in containerized Linux, keep --no-sandbox and --disable-dev-shm-usage launch args.',
        'Rebuild the devcontainer to align browser and dependency versions.',
      ],
      diagnostics: {
        executablePath: resolved.executablePath,
        source: resolved.source,
      },
    })
    process.exitCode = 1
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

await main()
