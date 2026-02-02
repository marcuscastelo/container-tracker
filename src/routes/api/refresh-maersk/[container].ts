import { type APIEvent } from '@solidjs/start/server'
import fs from 'node:fs'
import path from 'node:path'
import { chromium, type BrowserContext, type Route } from 'playwright'

interface CapturedData {
  url: string
  method: string
  headers: Record<string, string>
  status: number
  responseHeaders: Record<string, string>
  body: string
  cookies: Array<{ name: string; value: string; domain: string }>
  userAgent: string
  timestamp: string
}

export async function GET({ params, request }: APIEvent) {
  // Declare config variables in outer scope so they're available in catch
  let hold = false
  let browser: any = null
  let context: BrowserContext | null = null

  try {
    const container = params?.container
    if (!container) {
      return new Response(JSON.stringify({ error: 'container param required' }), { status: 400 })
    }

    const projectRoot = process.cwd()
    const collectionsDir = path.join(projectRoot, 'collections')
    if (!fs.existsSync(collectionsDir)) {
      return new Response(JSON.stringify({ error: 'collections directory not found' }), { status: 500 })
    }

    const provider = 'maersk'
    const providerDir = path.join(collectionsDir, provider)
    if (!fs.existsSync(providerDir)) {
      fs.mkdirSync(providerDir, { recursive: true })
    }

    const jsonPath = path.join(providerDir, `${container}.json`)
    const diagnosticsPath = path.join(providerDir, `${container}.json.devtools.json`)

    // Parse query params
    const url = new URL(request.url)
    const headless = url.searchParams.get('headless') === '1' || url.searchParams.get('headless') === 'true'
    hold = url.searchParams.get('hold') === '1'
    const timeoutMs = parseInt(url.searchParams.get('timeout') || '60000', 10)
    let userDataDir = url.searchParams.get('userDataDir') || process.env.CHROME_USER_DATA_DIR || null

    // Validate userDataDir exists
    if (userDataDir && !fs.existsSync(userDataDir)) {
      return new Response(
        JSON.stringify({
          error: 'userDataDir does not exist',
          providedPath: userDataDir,
          hint: 'Create the directory or use an existing Chrome profile path'
        }),
        { status: 400 }
      )
    }

    console.log('[maersk-refresh] Starting capture for container:', container)
    console.log('[maersk-refresh] Config:', { headless, hold, timeout: timeoutMs, userDataDir: userDataDir || 'ephemeral' })

    // Launch browser with stealth settings
    const launchOptions: any = {
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    }

    const persistent = !!userDataDir

    const contextOptions: any = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      viewport: { width: 1920, height: 1080 }
    }

    if (persistent) {
      // launchPersistentContext uses the provided userDataDir and returns a BrowserContext
      context = await chromium.launchPersistentContext(userDataDir as string, {
        headless,
        args: launchOptions.args,
        ...contextOptions,
      })
    } else {
      browser = await chromium.launch(launchOptions)
      context = await browser.newContext(contextOptions)
    }

    // At this point context is guaranteed to be non-null
    const ctx = context!

    // Apply stealth techniques (comprehensive)
    await ctx.addInitScript(() => {
      // Overwrite webdriver detection
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      
      // @ts-ignore - Chrome runtime
      window.chrome = { runtime: {} }
      
      // Remove automation-related properties
      // @ts-ignore
      delete navigator.__proto__.webdriver
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query
      // @ts-ignore
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      )
    })

    const page = await ctx.newPage()

    // Warmup: visit homepage first to establish session (avoid cold-start detection)
    console.log('[maersk-refresh] Warmup: visiting homepage to establish session')
    try {
      await page.goto('https://www.maersk.com', { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(1500 + Math.random() * 1000) // Random delay 1.5-2.5s
      
      // Simulate human mouse movement
      await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200)
      await page.waitForTimeout(300 + Math.random() * 200)
      await page.mouse.move(400 + Math.random() * 300, 200 + Math.random() * 200)
    } catch (err) {
      console.warn('[maersk-refresh] Warmup navigation failed, continuing anyway', err)
    }

    // Capture state
    const captureState: { data: CapturedData | null } = { data: null }

    // Setup route interception for Maersk API
    await ctx.route('**/synergy/tracking/**', async (route: Route) => {
      const routeRequest = route.request()
      const requestUrl = routeRequest.url()

      console.log('[maersk-refresh] Intercepted request:', requestUrl)

      // Continue the request and capture response
      const response = await route.fetch()
      const status = response.status()
      const responseHeaders = await response.headersArray()
      const cookies = await ctx.cookies()
      const bodyText = await response.text()

      console.log('[maersk-refresh] Captured response:', { url: requestUrl, status, bodyLength: bodyText.length })

      // Convert headers array to object
      const reqHeadersObj: Record<string, string> = {}
      const reqHeaders = await routeRequest.headersArray()
      for (const { name, value } of reqHeaders) {
        reqHeadersObj[name] = value
      }

      const respHeadersObj: Record<string, string> = {}
      for (const { name, value } of responseHeaders) {
        respHeadersObj[name] = value
      }

      captureState.data = {
        url: requestUrl,
        method: routeRequest.method(),
        headers: reqHeadersObj,
        status,
        responseHeaders: respHeadersObj,
        body: bodyText,
        cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
        userAgent: contextOptions.userAgent,
        timestamp: new Date().toISOString()
      }

      // Fulfill with original response
      await route.fulfill({ response })
    })

    // Navigate to tracking page
    const trackingUrl = `https://www.maersk.com/tracking/${container}`
    console.log('[maersk-refresh] Navigating to:', trackingUrl)

    // Human-like delay before navigation
    await page.waitForTimeout(800 + Math.random() * 400)

    await page.goto(trackingUrl, { waitUntil: 'networkidle', timeout: timeoutMs })

    // Simulate human interaction: scroll, mouse movements
    await page.waitForTimeout(1000 + Math.random() * 500)
    
    try {
      await page.mouse.move(300, 200)
      await page.waitForTimeout(200)
      await page.evaluate(() => window.scrollBy(0, 100))
      await page.waitForTimeout(300 + Math.random() * 200)
      await page.mouse.move(500 + Math.random() * 100, 300 + Math.random() * 100)
    } catch (err) {
      console.debug('[maersk-refresh] Mouse/scroll simulation failed', err)
    }

    // Wait for API calls with human-like delay
    await page.waitForTimeout(2000 + Math.random() * 1000)

    // If hold mode, keep browser open for manual inspection
    if (hold) {
      console.log('[maersk-refresh] HOLD mode active - browser will stay open. Press Ctrl+C to exit.')
      await new Promise(() => {}) // never resolves
    }

    // Close the browser/context unless we're holding it open for manual inspection
    if (!hold) {
      try {
        if (persistent) {
          await ctx.close()
        } else if (browser) {
          await browser.close()
        }
      } catch (e) {
        console.warn('[maersk-refresh] error closing browser/context', e)
      }
    }

    // Check if we captured data
    if (!captureState.data) {
      return new Response(
        JSON.stringify({
          error: 'No API request intercepted',
          hint: 'The page did not make a request to /synergy/tracking/. Check if the container number is valid or if Maersk changed their API.',
          expectedUrl: `https://api.maersk.com/synergy/tracking/${container}`
        }),
        { status: 502 }
      )
    }

    const captured = captureState.data

    // Check for Akamai block
    if (captured.status === 403 && captured.body.includes('Access Denied')) {
      // Write diagnostics for debugging
      const diagnostics = {
        request: {
          url: captured.url,
          method: captured.method,
          headers: captured.headers
        },
        cookies: captured.cookies,
        userAgent: captured.userAgent,
        capturedAt: captured.timestamp,
        source: 'playwright-route-interception',
        response: {
          status: captured.status,
          headers: captured.responseHeaders
        },
        blockedResponse: captured.body
      }
      fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')

      return new Response(
        JSON.stringify({
          error: 'Access Denied by Akamai',
          hint: 'The API request was blocked. To fix this:\n1. Open Chrome normally and log into www.maersk.com\n2. Find your Chrome profile directory:\n   - Windows: %LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\n   - macOS: ~/Library/Application Support/Google/Chrome/Default\n   - Linux: ~/.config/google-chrome/default\n3. Call the API with ?userDataDir=/path/to/profile\n   Example: ?userDataDir=/home/user/.config/google-chrome/default\n4. Alternatively, set CHROME_USER_DATA_DIR environment variable',
          diagnostics: {
            status: captured.status,
            url: captured.url,
            diagnosticsFile: path.relative(projectRoot, diagnosticsPath),
            cookiesPresent: captured.cookies.length,
            userDataDir: userDataDir || 'none (ephemeral session)'
          }
        }),
        { status: 403 }
      )
    }

    // Check for successful JSON response
    let parsedJson: any = null
    try {
      parsedJson = JSON.parse(captured.body)
    } catch {
      // Not JSON, might be HTML error
      if (captured.body.includes('<HTML>') || captured.body.includes('<!DOCTYPE')) {
        return new Response(
          JSON.stringify({
            error: 'Received HTML instead of JSON',
            status: captured.status,
            hint: 'The API returned an error page. Check diagnostics file for details.',
            diagnosticsFile: path.relative(projectRoot, diagnosticsPath)
          }),
          { status: 502 }
        )
      }
    }

    // Write captured JSON to file
    const outputJson = parsedJson || captured.body
    fs.writeFileSync(jsonPath, JSON.stringify(outputJson, null, 2), 'utf-8')
    console.log(`[maersk-refresh] Wrote ${path.relative(projectRoot, jsonPath)} (${captured.body.length} bytes)`)

    // Write diagnostics
    const diagnostics = {
      request: {
        url: captured.url,
        method: captured.method,
        headers: captured.headers
      },
      cookies: captured.cookies,
      userAgent: captured.userAgent,
      capturedAt: captured.timestamp,
      source: 'playwright-route-interception',
      response: {
        status: captured.status,
        headers: captured.responseHeaders
      }
    }
    fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')
    console.log(`[maersk-refresh] Wrote diagnostics to ${path.relative(projectRoot, diagnosticsPath)}`)

    return new Response(
      JSON.stringify({
        ok: true,
        updatedPath: path.relative(projectRoot, jsonPath),
        diagnosticsPath: path.relative(projectRoot, diagnosticsPath),
        status: captured.status,
        bytesWritten: captured.body.length
      }),
      { status: 200 }
    )
  } catch (err: any) {
    console.error('[maersk-refresh] Error:', err)
    // Attempt cleanup
    try {
      if (!hold) {
        // @ts-ignore
        if (context) await ctx.close()
        // @ts-ignore
        if (browser) await browser.close()
      }
    } catch (closeErr) {
      console.warn('[maersk-refresh] error during cleanup', closeErr)
    }

    return new Response(
      JSON.stringify({
        error: String(err),
        stack: err.stack
      }),
      { status: 500 }
    )
  }
}

export const POST = GET
