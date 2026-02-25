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

function normalizeForMatch(value: string): string {
  return value.toUpperCase().trim()
}

function isTrackingApiResponseUrl(url: string): boolean {
  const normalized = url.toLowerCase()
  return normalized.includes('api.maersk.com') && normalized.includes('/synergy/tracking')
}

function scoreTrackingCaptureCandidate(url: string, body: string, container: string): number {
  const containerKey = normalizeForMatch(container)
  let score = 0

  if (url.toLowerCase().includes('/synergy/tracking/')) {
    score += 1
  }

  if (normalizeForMatch(url).includes(containerKey)) {
    score += 2
  }

  if (normalizeForMatch(body).includes(containerKey)) {
    score += 3
  }

  return score
}

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

function findSystemChrome(): string | null {
  const envPath = process.env.CHROME_PATH || process.env.CHROMIUM_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  const platform = process.platform
  const candidates: string[] = []

  if (platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files'
    const programFilesx86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    candidates.push(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    candidates.push(path.join(programFilesx86, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium')
  } else {
    candidates.push('/usr/bin/google-chrome')
    candidates.push('/usr/bin/google-chrome-stable')
    candidates.push('/usr/bin/chromium-browser')
    candidates.push('/usr/bin/chromium')
    candidates.push('/snap/bin/chromium')
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

export function createMaerskCaptureService(): MaerskCaptureService {
  return {
    async capture(command: CaptureMaerskCommand): Promise<MaerskCaptureResult> {
      let browser: Browser | null = null

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

      const executablePath = findSystemChrome()
      if (executablePath) {
        launchOpts.executablePath = executablePath
        console.log('[maersk-refresh] Using Chrome at:', executablePath)
      }

      try {
        browser = await puppeteerExtra.launch(launchOpts)
      } catch (error) {
        return {
          kind: 'error',
          status: 500,
          body: {
            error: 'Browser launch failed',
            details: String(error),
            hint: 'Install Chrome/Chromium or set CHROME_PATH',
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

        const captureState: { data: CapturedData | null; score: number } = {
          data: null,
          score: Number.NEGATIVE_INFINITY,
        }
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
              isTrackingApiResponseUrl(responseUrl)
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
                const candidateScore = scoreTrackingCaptureCandidate(
                  responseUrl,
                  body,
                  command.container,
                )

                if (candidateScore >= captureState.score) {
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
                  captureState.score = candidateScore
                }

                console.log('[maersk-refresh] Candidate capture score:', candidateScore)
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
        const apiFallbackUrl = `https://api.maersk.com/synergy/tracking/${encodeURIComponent(command.container)}`

        const tryApiFallback = async () => {
          if (captureState.data) return

          console.log('[maersk-refresh] Fallback: navigating directly to API URL:', apiFallbackUrl)
          try {
            await page.goto(apiFallbackUrl, {
              waitUntil: 'networkidle0',
              timeout: Math.max(15000, Math.floor(command.timeoutMs / 2)),
            })
          } catch (error) {
            console.warn('[maersk-refresh] API fallback navigation failed:', error)
          }

          await delay(1500 + Math.random() * 500)
        }

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

        await tryApiFallback()

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
              hint: 'No /synergy/tracking response was observed, even after direct API fallback. Try hold/profile diagnostics.',
              expectedUrl: apiFallbackUrl,
              diagnostics: {
                attemptedFallback: true,
              },
            },
          }
        }

        const captured = captureState.data

        if (captured.status === 403 || captured.body.includes('Access Denied')) {
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
