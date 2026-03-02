import fs from 'node:fs'
import path from 'node:path'
import type { Browser } from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

/** Helper for delays (Puppeteer doesn't have page.waitForTimeout) */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type CapturedData = {
  url: string
  method: string
  headers: Record<string, string>
  postData?: string
  status: number
  body: string
  cookies: readonly CapturedCookie[]
  userAgent: string
  telemetry: string | null
  timestamp: string
}

type CapturedCookie = {
  readonly name?: string
  readonly value?: string
  readonly domain?: string
}

type CapturedRequestMeta = {
  readonly url: string
  readonly method: string
  readonly headers: Record<string, string>
  readonly postData?: string
}

type BrowserResolution =
  | {
      readonly kind: 'ok'
      readonly executablePath: string
      readonly source: 'CHROME_PATH' | 'CHROMIUM_PATH' | 'system-candidate' | 'puppeteer-cache'
    }
  | {
      readonly kind: 'error'
      readonly cause: 'missing_browser_binary' | 'invalid_chrome_path'
      readonly message: string
      readonly hints: readonly string[]
      readonly diagnostics: Record<string, unknown>
    }

const LINUX_BROWSER_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/lib/chromium/chromium',
  '/snap/bin/chromium',
]

const DARWIN_BROWSER_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const entries: [string, string][] = []
  for (const [k, v] of Object.entries(value)) {
    entries.push([k, String(v)])
  }
  return Object.fromEntries(entries)
}

function toCaptureCookie(cookie: unknown): CapturedCookie {
  if (!isRecord(cookie)) return {}
  return {
    name: typeof cookie.name === 'string' ? cookie.name : undefined,
    value: typeof cookie.value === 'string' ? cookie.value : undefined,
    domain: typeof cookie.domain === 'string' ? cookie.domain : undefined,
  }
}

export type CaptureMaerskCommand = {
  readonly container: string
  readonly headless: boolean
  readonly hold: boolean
  readonly timeoutMs: number
  readonly userDataDir: string | null
}

export type MaerskCaptureResult =
  | {
      readonly kind: 'ok'
      readonly status: number
      readonly payload: unknown
    }
  | {
      readonly kind: 'error'
      readonly status: number
      readonly body: Record<string, unknown>
    }

export type MaerskCaptureService = {
  capture(command: CaptureMaerskCommand): Promise<MaerskCaptureResult>
}

function isExecutable(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false
  try {
    fs.accessSync(filePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function normalizeEnvPath(variableName: 'CHROME_PATH' | 'CHROMIUM_PATH'): string | null {
  const value = process.env[variableName]
  if (!value) return null
  if (path.isAbsolute(value)) return value
  return path.resolve(process.cwd(), value)
}

function resolveBrowserExecutablePath(): BrowserResolution {
  const envVariables: readonly ('CHROME_PATH' | 'CHROMIUM_PATH')[] = ['CHROME_PATH', 'CHROMIUM_PATH']
  for (const variableName of envVariables) {
    const envPath = normalizeEnvPath(variableName)
    if (!envPath) continue

    if (isExecutable(envPath)) {
      return {
        kind: 'ok',
        executablePath: envPath,
        source: variableName,
      }
    }

    return {
      kind: 'error',
      cause: 'invalid_chrome_path',
      message: `${variableName} is set but does not point to an executable browser binary.`,
      hints: [
        'Fix CHROME_PATH/CHROMIUM_PATH to a valid executable path.',
        'In devcontainer, rebuild and ensure Chromium is available at /usr/bin/chromium.',
      ],
      diagnostics: {
        variableName,
        configuredPath: process.env[variableName] ?? null,
        resolvedPath: envPath,
        exists: fs.existsSync(envPath),
      },
    }
  }

  const platform = process.platform
  const candidates: string[] = []

  if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesx86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    candidates.push(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    candidates.push(path.join(programFilesx86, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  } else if (platform === 'darwin') {
    candidates.push(...DARWIN_BROWSER_CANDIDATES)
  } else {
    candidates.push(...LINUX_BROWSER_CANDIDATES)
  }

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return {
        kind: 'ok',
        executablePath: candidate,
        source: 'system-candidate',
      }
    }
  }

  let puppeteerCachePath: string | null = null
  try {
    const defaultPath = puppeteerExtra.executablePath()
    puppeteerCachePath = defaultPath.length > 0 ? defaultPath : null
  } catch {
    puppeteerCachePath = null
  }

  if (puppeteerCachePath && isExecutable(puppeteerCachePath)) {
    return {
      kind: 'ok',
      executablePath: puppeteerCachePath,
      source: 'puppeteer-cache',
    }
  }

  return {
    kind: 'error',
    cause: 'missing_browser_binary',
    message: 'No executable Chrome/Chromium binary was found for Puppeteer launch.',
    hints: [
      'In devcontainer, ensure Chromium is installed and available at /usr/bin/chromium.',
      'Set CHROME_PATH to a valid binary path or install Puppeteer browser cache with: pnpm exec puppeteer browsers install chrome',
    ],
    diagnostics: {
      CHROME_PATH: process.env.CHROME_PATH ?? null,
      CHROMIUM_PATH: process.env.CHROMIUM_PATH ?? null,
      checkedCandidates: candidates,
      puppeteerExpectedPath: puppeteerCachePath,
      puppeteerPathExists: puppeteerCachePath ? fs.existsSync(puppeteerCachePath) : false,
    },
  }
}

export function createMaerskCaptureService(): MaerskCaptureService {
  return {
    async capture(command: CaptureMaerskCommand): Promise<MaerskCaptureResult> {
      let browser: Browser | null = null

      const projectRoot = process.cwd()
      const collectionsDir = path.join(projectRoot, 'collections')
      if (!fs.existsSync(collectionsDir)) {
        return {
          kind: 'error',
          status: 500,
          body: { error: 'collections directory not found' },
        }
      }

      const providerDir = path.join(collectionsDir, 'maersk')
      if (!fs.existsSync(providerDir)) {
        fs.mkdirSync(providerDir, { recursive: true })
      }

      const diagnosticsPath = path.join(providerDir, `${command.container}.json.devtools.json`)

      if (command.userDataDir && !fs.existsSync(command.userDataDir)) {
        return {
          kind: 'error',
          status: 400,
          body: {
            error: 'userDataDir does not exist',
            hint: 'Create the directory or use an existing Chrome profile path',
            diagnostics: { providedPath: command.userDataDir },
          },
        }
      }

      console.log('[maersk-refresh] Starting capture for container:', command.container)
      console.log('[maersk-refresh] Config:', {
        headless: command.headless,
        hold: command.hold,
        timeout: command.timeoutMs,
        userDataDir: command.userDataDir || 'ephemeral',
      })

      try {
        puppeteerExtra.use(StealthPlugin())
      } catch (error) {
        return {
          kind: 'error',
          status: 500,
          body: {
            error: 'puppeteer import error',
            details: String(error),
          },
        }
      }

      const launchArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ]

      type BrowserLaunchOptions = NonNullable<Parameters<typeof puppeteerExtra.launch>[0]>
      const launchOpts: BrowserLaunchOptions = {
        headless: command.headless,
        args: launchArgs,
        defaultViewport: { width: 1920, height: 1080 },
      }

      if (command.userDataDir) {
        launchOpts.userDataDir = command.userDataDir
      }

      const browserResolution = resolveBrowserExecutablePath()
      if (browserResolution.kind === 'error') {
        return {
          kind: 'error',
          status: 500,
          body: {
            error: 'Browser launch failed',
            cause: browserResolution.cause,
            details: browserResolution.message,
            hint: browserResolution.hints[0],
            hints: browserResolution.hints,
            diagnostics: browserResolution.diagnostics,
          },
        }
      }

      launchOpts.executablePath = browserResolution.executablePath
      console.log(
        `[maersk-refresh] Using Chrome at: ${browserResolution.executablePath} (source: ${browserResolution.source})`,
      )

      try {
        browser = await puppeteerExtra.launch(launchOpts)
      } catch (error) {
        return {
          kind: 'error',
          status: 500,
          body: {
            error: 'Browser launch failed',
            cause: 'launch_incompatibility',
            details: String(error),
            hint: 'Confirm CHROME_PATH points to a compatible Chromium/Chrome binary.',
            diagnostics: {
              executablePath: browserResolution.executablePath,
              source: browserResolution.source,
            },
          },
        }
      }

      try {
        const page = await browser.newPage()

        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        )
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false })
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
          })
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          })
          // @ts-expect-error runtime browser patch
          window.chrome = { runtime: {} }
          // @ts-expect-error runtime browser patch
          delete navigator.__proto__.webdriver
        })

        const cdpClient = await page.createCDPSession()
        await cdpClient.send('Network.enable')

        const captureState: { data: CapturedData | null } = { data: null }
        const reqMap = new Map<string, CapturedRequestMeta>()

        cdpClient.on('Network.requestWillBeSent', (evt: unknown) => {
          try {
            if (!isRecord(evt)) return
            const request = isRecord(evt.request) ? evt.request : null
            const requestId = typeof evt.requestId === 'string' ? evt.requestId : null
            if (!request || !requestId || typeof request.url !== 'string') return

            reqMap.set(requestId, {
              url: request.url,
              method: typeof request.method === 'string' ? request.method : 'GET',
              headers: toStringMap(request.headers),
              postData: typeof request.postData === 'string' ? request.postData : undefined,
            })
          } catch {
            /* ignore */
          }
        })

        cdpClient.on('Network.responseReceived', async (evt: unknown) => {
          try {
            if (!isRecord(evt)) return
            const response = isRecord(evt.response) ? evt.response : null
            const responseUrl = response && typeof response.url === 'string' ? response.url : null
            const requestId = typeof evt.requestId === 'string' ? evt.requestId : null
            const status = response && typeof response.status === 'number' ? response.status : null

            if (
              responseUrl &&
              requestId &&
              status !== null &&
              responseUrl.includes('/synergy/tracking/') &&
              responseUrl.includes(command.container)
            ) {
              console.log('[maersk-refresh] CDP captured response:', responseUrl, 'status:', status)

              try {
                const bodyResult = await cdpClient.send('Network.getResponseBody', {
                  requestId,
                })
                if (!isRecord(bodyResult) || typeof bodyResult.body !== 'string') return

                const body = bodyResult.base64Encoded
                  ? Buffer.from(bodyResult.body, 'base64').toString('utf8')
                  : bodyResult.body

                const reqInfo = reqMap.get(requestId)

                let telemetry: string | null = null
                try {
                  telemetry = await page.evaluate(() => {
                    try {
                      // @ts-expect-error dynamic access to anti-bot runtime
                      const bmak = window.bmak
                      if (bmak && typeof bmak.get_telemetry === 'function')
                        return bmak.get_telemetry()
                    } catch {
                      /* ignore */
                    }
                    return null
                  })
                } catch {
                  telemetry = null
                }

                const cookiesRaw = await page.cookies()
                const cookies = cookiesRaw.map(toCaptureCookie)
                const userAgent = await page.evaluate(() => navigator.userAgent)

                captureState.data = {
                  url: responseUrl,
                  method: reqInfo?.method ?? 'GET',
                  headers: reqInfo?.headers ?? {},
                  postData: reqInfo?.postData,
                  status,
                  body,
                  cookies,
                  userAgent,
                  telemetry,
                  timestamp: new Date().toISOString(),
                }
              } catch (error) {
                console.error('[maersk-refresh] Error getting response body:', error)
              }
            }
          } catch {
            /* ignore */
          }
        })

        console.log('[maersk-refresh] Warmup: visiting homepage')
        try {
          await page.goto('https://www.maersk.com', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
          })
          await delay(1500 + Math.random() * 1000)
          await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200)
          await delay(300 + Math.random() * 200)
          await page.mouse.move(400 + Math.random() * 300, 200 + Math.random() * 200)
        } catch (error) {
          console.warn('[maersk-refresh] Warmup failed, continuing:', error)
        }

        const trackingUrl = `https://www.maersk.com/tracking/${command.container}`
        console.log('[maersk-refresh] Navigating to:', trackingUrl)

        await delay(800 + Math.random() * 400)

        try {
          await page.goto(trackingUrl, {
            waitUntil: 'networkidle0',
            timeout: command.timeoutMs,
          })
        } catch {
          console.warn('[maersk-refresh] Navigation timeout, checking if we captured response')
        }

        await delay(2000 + Math.random() * 1000)

        try {
          await page.mouse.move(300, 200)
          await delay(200)
          await page.evaluate(() => window.scrollBy(0, 100))
          await delay(300 + Math.random() * 200)
        } catch {
          /* ignore */
        }

        if (!captureState.data) {
          console.log('[maersk-refresh] Waiting for API response...')
          await delay(3000)
        }

        if (!captureState.data) {
          try {
            await page.waitForFunction(
              () =>
                typeof window !== 'undefined' &&
                // @ts-expect-error dynamic access to anti-bot runtime
                window.bmak &&
                // @ts-expect-error dynamic access to anti-bot runtime
                typeof window.bmak.get_telemetry === 'function',
              { timeout: 10000 },
            )
            await delay(2000)
          } catch {
            console.debug('[maersk-refresh] bmak not found')
          }
        }

        if (command.hold) {
          console.log('[maersk-refresh] HOLD mode - browser stays open. Press Ctrl+C to exit.')
          await new Promise(() => {})
        }

        if (browser) {
          try {
            await browser.close()
          } catch (error) {
            console.warn('[maersk-refresh] Error closing browser:', error)
          }
          browser = null
        }

        if (!captureState.data) {
          return {
            kind: 'error',
            status: 502,
            body: {
              error: 'No API response captured',
              hint: 'The page did not make a request to /synergy/tracking/. Try with ?hold=1 to inspect manually.',
              expectedUrl: `https://api.maersk.com/synergy/tracking/${command.container}`,
            },
          }
        }

        const captured = captureState.data

        if (captured.status === 403 || captured.body.includes('Access Denied')) {
          const diagnostics = {
            request: {
              url: captured.url,
              method: captured.method,
              headers: captured.headers,
            },
            cookies: captured.cookies.map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
            })),
            userAgent: captured.userAgent,
            telemetry: captured.telemetry ? `${captured.telemetry.substring(0, 100)}...` : null,
            capturedAt: captured.timestamp,
            source: 'puppeteer-cdp',
            response: {
              status: captured.status,
            },
            blockedResponse: captured.body,
          }

          fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')

          return {
            kind: 'error',
            status: 403,
            body: {
              error: 'Access Denied by Akamai',
              hint: 'Try with a warmed Chrome profile:\n1. Create profile: mkdir -p /tmp/maersk-profile\n2. Visit Maersk manually: google-chrome --user-data-dir=/tmp/maersk-profile https://www.maersk.com\n3. Click around, solve any CAPTCHAs\n4. Close Chrome\n5. Call API with ?userDataDir=/tmp/maersk-profile',
              diagnostics: {
                status: captured.status,
                url: captured.url,
                cookiesPresent: captured.cookies.length,
                telemetryPresent: !!captured.telemetry,
                userDataDir: command.userDataDir || 'none (ephemeral)',
              },
            },
          }
        }

        let parsedJson: unknown = null
        try {
          parsedJson = JSON.parse(captured.body)
        } catch {
          if (captured.body.includes('<HTML>') || captured.body.includes('<!DOCTYPE')) {
            return {
              kind: 'error',
              status: 502,
              body: {
                error: 'Received HTML instead of JSON',
                status: captured.status,
              },
            }
          }
        }

        const payload = parsedJson ?? { raw: captured.body }

        const diagnostics = {
          request: {
            url: captured.url,
            method: captured.method,
            headers: captured.headers,
          },
          cookies: captured.cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
          })),
          userAgent: captured.userAgent,
          telemetry: captured.telemetry ? `${captured.telemetry.substring(0, 100)}...` : null,
          capturedAt: captured.timestamp,
          source: 'puppeteer-cdp',
          response: {
            status: captured.status,
          },
        }

        try {
          fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')
          console.log(
            `[maersk-refresh] Wrote diagnostics to ${path.relative(projectRoot, diagnosticsPath)}`,
          )
        } catch (error) {
          console.warn('[maersk-refresh] Could not write diagnostics file:', error)
        }

        return {
          kind: 'ok',
          status: captured.status,
          payload,
        }
      } catch (error) {
        if (browser) {
          try {
            await browser.close()
          } catch {
            /* ignore */
          }
        }

        return {
          kind: 'error',
          status: 500,
          body: {
            error: 'Unexpected maersk capture error',
            details: String(error),
          },
        }
      }
    },
  }
}
