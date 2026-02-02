import fs from 'fs'
import path from 'path'
import { chromium, type BrowserContext, type Page } from 'playwright'

/**
 * Maersk container tracking refresh route.
 *
 * Opens the Maersk tracking page in a Playwright browser and intercepts the
 * API response from https://api.maersk.com/synergy/tracking/{container}
 * that the page automatically fetches. The response JSON is saved to
 * collections/maersk/<container>.json.
 *
 * Query params:
 *   ?headless=1|0       - Run headless (default: false for debugging)
 *   ?userDataDir=...    - Chrome user data directory for persistent sessions
 *   ?hold=1             - Keep browser open after capture for manual inspection
 *   ?timeout=<ms>       - Custom timeout for response capture (default: 45000)
 */

interface CapturedResponse {
  url: string
  status: number
  headers: Record<string, string>
  body: string
  json?: unknown
}

interface Diagnostics {
  request: {
    url: string
    method: string
    headers: Record<string, string>
  } | null
  response: {
    status: number
    headers: Record<string, string>
  } | null
  cookies: Array<{ name: string; value: string; domain: string }>
  userAgent: string
  capturedAt: string
  source: 'playwright-route-interception'
}

export async function GET({ params, request }: { params: { container?: string }; request: Request }) {
  const container = params?.container
  if (!container) {
    return new Response(JSON.stringify({ error: 'container param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const projectRoot = process.cwd()
  const collectionsDir = path.join(projectRoot, 'collections')
  const provider = 'maersk'
  const providerDir = path.join(collectionsDir, provider)

  // Validate directories
  if (!fs.existsSync(collectionsDir)) {
    return new Response(JSON.stringify({ error: 'collections directory not found' }), { status: 500 })
  }
  if (!fs.existsSync(providerDir)) {
    return new Response(JSON.stringify({ error: 'maersk collections directory not found' }), { status: 500 })
  }

  const jsonPath = path.join(providerDir, `${container}.json`)
  const diagnosticsPath = jsonPath + '.devtools.json'

  // Parse query params
  const url = new URL(request.url)
  const headless = url.searchParams.get('headless') !== '0' // default headless=true
  const hold = url.searchParams.get('hold') === '1'
  const timeout = parseInt(url.searchParams.get('timeout') || '45000', 10)
  let userDataDir = url.searchParams.get('userDataDir')
  if (!userDataDir) {
    userDataDir = process.env.CHROME_USER_DATA_DIR || process.env.USER_DATA_DIR || null
  }

  console.log(`refresh-maersk: starting capture for container ${container}`)
  console.log(`refresh-maersk: headless=${headless}, hold=${hold}, timeout=${timeout}`)

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null

  try {
    // Launch browser with stealth args
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    }

    // Find system Chrome if needed
    const systemChrome = findSystemChrome()
    if (systemChrome) {
      launchOptions.executablePath = systemChrome
      console.log(`refresh-maersk: using system Chrome at ${systemChrome}`)
    }

    browser = await chromium.launch(launchOptions)

    // Create context with optional persistent storage
    const contextOptions: Parameters<typeof browser.newContext>[0] = {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }

    if (userDataDir && fs.existsSync(userDataDir)) {
      // For persistent context, we need to use launchPersistentContext instead
      // For now, just use a regular context
      console.log(`refresh-maersk: note - userDataDir provided but using regular context`)
    }

    context = await browser.newContext(contextOptions)

    // Mask webdriver detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      // @ts-ignore
      window.chrome = { runtime: {} }
    })

    // Set up response capture BEFORE navigation
    // Using an object to store capture state (avoids TypeScript closure narrowing issues)
    const capture: {
      response: CapturedResponse | null
      request: { url: string; method: string; headers: Record<string, string> } | null
    } = { response: null, request: null }

    // Use route interception to capture the tracking API response
    // This catches ALL traffic including Service Worker requests
    await context.route('**/synergy/tracking/**', async (route) => {
      const req = route.request()
      const reqUrl = req.url()

      console.log(`refresh-maersk: intercepted request to ${reqUrl}`)

      // Store request info
      capture.request = {
        url: reqUrl,
        method: req.method(),
        headers: req.headers(),
      }

      try {
        // Let the request proceed and capture the response
        const response = await route.fetch()
        const status = response.status()
        const headers = response.headers()
        const body = await response.text()

        console.log(`refresh-maersk: captured response status=${status}, size=${body.length}`)

        // Parse JSON if possible
        let json: unknown
        try {
          json = JSON.parse(body)
        } catch {
          // Not JSON
        }

        capture.response = {
          url: reqUrl,
          status,
          headers,
          body,
          json,
        }

        // Continue the request with the original response so the page works normally
        await route.fulfill({
          status,
          headers,
          body,
        })
      } catch (err) {
        console.error(`refresh-maersk: error fetching response`, err)
        // Continue the request normally if fetch fails
        await route.continue()
      }
    })

    // Create page and navigate
    page = await context.newPage()
    const trackingUrl = `https://www.maersk.com/tracking/${container}`

    console.log(`refresh-maersk: navigating to ${trackingUrl}`)

    try {
      await page.goto(trackingUrl, { waitUntil: 'networkidle', timeout })
    } catch (err) {
      console.warn(`refresh-maersk: navigation timeout/error, checking if we captured response anyway`)
    }

    // Wait a bit more for any late API calls
    if (!capture.response) {
      console.log(`refresh-maersk: waiting additional time for API response...`)
      await page.waitForTimeout(5000)
    }

    // Collect diagnostics
    const cookies = await context.cookies()
    const relevantCookies = cookies.filter(
      (c) => c.domain.includes('maersk.com') || c.domain.includes('api.maersk.com')
    )
    const userAgent = await page.evaluate(() => navigator.userAgent)

    // Build base diagnostics (response details added after null check)
    const baseDiagnostics = {
      request: capture.request,
      cookies: relevantCookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain })),
      userAgent,
      capturedAt: new Date().toISOString(),
      source: 'playwright-route-interception' as const,
    }

    // Check if we got a valid response
    if (!capture.response) {
      const diagnostics: Diagnostics = { ...baseDiagnostics, response: null }
      // Write diagnostics for debugging
      fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')
      console.log(`refresh-maersk: wrote diagnostics to ${path.relative(projectRoot, diagnosticsPath)}`)

      if (hold) {
        console.log(`refresh-maersk: holding browser open for manual inspection`)
        return new Response(
          JSON.stringify({
            ok: false,
            reason: 'no-response-captured',
            diagnosticsPath: path.relative(projectRoot, diagnosticsPath),
            hint: 'Browser is held open for inspection. Check DevTools Network tab.',
          }),
          { status: 202 }
        )
      }

      await browser.close()
      return new Response(
        JSON.stringify({
          error: 'Failed to capture API response',
          diagnostics,
        }),
        { status: 502 }
      )
    }

    // Now we know capture.response is not null - extract to typed variable
    const resp = capture.response!
    const diagnostics: Diagnostics = {
      ...baseDiagnostics,
      response: {
        status: resp.status,
        headers: resp.headers,
      },
    }

    // Check for Access Denied or non-JSON response
    if (resp.status === 403 || (resp.body && resp.body.includes('Access Denied'))) {
      fs.writeFileSync(diagnosticsPath, JSON.stringify({ ...diagnostics, blockedResponse: resp.body.substring(0, 1000) }, null, 2), 'utf-8')

      if (hold) {
        console.log(`refresh-maersk: Access Denied - holding browser open`)
        return new Response(
          JSON.stringify({
            ok: false,
            reason: 'access-denied',
            diagnosticsPath: path.relative(projectRoot, diagnosticsPath),
          }),
          { status: 202 }
        )
      }

      await browser.close()
      return new Response(
        JSON.stringify({
          error: 'Access Denied by Akamai',
          hint: 'Try with a userDataDir that has existing session cookies',
          diagnostics,
        }),
        { status: 403 }
      )
    }

    // Write the JSON response
    const jsonContent = resp.json
      ? JSON.stringify(resp.json, null, 4)
      : resp.body

    fs.writeFileSync(jsonPath, jsonContent, 'utf-8')
    console.log(`refresh-maersk: wrote ${path.relative(projectRoot, jsonPath)} (${jsonContent.length} bytes)`)

    // Write diagnostics
    fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')
    console.log(`refresh-maersk: wrote diagnostics to ${path.relative(projectRoot, diagnosticsPath)}`)

    if (hold) {
      console.log(`refresh-maersk: success - holding browser open for inspection`)
      return new Response(
        JSON.stringify({
          ok: true,
          updatedPath: path.relative(projectRoot, jsonPath),
          diagnosticsPath: path.relative(projectRoot, diagnosticsPath),
          held: true,
        }),
        { status: 200 }
      )
    }

    await browser.close()

    return new Response(
      JSON.stringify({
        ok: true,
        updatedPath: path.relative(projectRoot, jsonPath),
        diagnosticsPath: path.relative(projectRoot, diagnosticsPath),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('refresh-maersk: error', err)

    // Cleanup
    try {
      if (browser && !hold) await browser.close()
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export const POST = GET

/**
 * Find a Chrome/Chromium executable on the system
 */
function findSystemChrome(): string | null {
  const envPath = process.env.CHROME_PATH || process.env.CHROMIUM_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  const platform = process.platform
  const candidates: string[] = []

  if (platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files'
    const programFilesx86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'
    candidates.push(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    candidates.push(path.join(programFilesx86, 'Google', 'Chrome', 'Application', 'chrome.exe'))
  } else if (platform === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium')
  } else {
    // Linux
    candidates.push('/usr/bin/google-chrome')
    candidates.push('/usr/bin/google-chrome-stable')
    candidates.push('/usr/bin/chromium-browser')
    candidates.push('/usr/bin/chromium')
    candidates.push('/snap/bin/chromium')
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  return null
}
