import type { APIEvent } from '@solidjs/start/server'
import fs from 'fs'
import path from 'path'

/** Helper for delays (Puppeteer doesn't have page.waitForTimeout) */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Maersk container tracking refresh route using Puppeteer + Stealth plugin.
 * 
 * Opens the Maersk tracking page and intercepts the API response via CDP.
 * Uses puppeteer-extra-plugin-stealth for better bot detection evasion.
 * 
 * Query params:
 *   ?headless=0|1     - Run headless (default: false)
 *   ?userDataDir=...  - Chrome profile directory for persistent session
 *   ?hold=1           - Keep browser open for manual inspection
 *   ?timeout=<ms>     - Navigation timeout (default: 60000)
 */

interface CapturedData {
  url: string
  method: string
  headers: Record<string, string>
  postData?: string
  status: number
  body: string
  cookies: any[]
  userAgent: string
  telemetry: string | null
  timestamp: string
}

export async function GET({ params, request }: APIEvent) {
  // Outer scope for cleanup in catch block
  let hold = false
  let browser: any = null

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

    // Validate userDataDir
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

    // Import puppeteer-extra with stealth
    let puppeteerExtra: any
    try {
      const pe = await import('puppeteer-extra').catch(() => null)
      const stealthMod = await import('puppeteer-extra-plugin-stealth').catch(() => null)
      
      if (!pe || !stealthMod) {
        return new Response(
          JSON.stringify({
            error: 'puppeteer-extra or stealth plugin not installed',
            hint: 'Run: npm i -D puppeteer puppeteer-extra puppeteer-extra-plugin-stealth'
          }),
          { status: 500 }
        )
      }
      
      puppeteerExtra = (pe as any).default || pe
      const Stealth = (stealthMod as any).default || stealthMod
      puppeteerExtra.use(Stealth())
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'puppeteer import error', details: String(e) }),
        { status: 500 }
      )
    }

    // Find Chrome executable
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

    // Launch browser
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ]

    const launchOpts: any = {
      headless: headless ? 'new' : false,
      args: launchArgs,
      defaultViewport: { width: 1920, height: 1080 }
    }

    // Add userDataDir if provided
    if (userDataDir) {
      launchOpts.userDataDir = userDataDir
    }

    // Find executable
    const executablePath = findSystemChrome()
    if (executablePath) {
      launchOpts.executablePath = executablePath
      console.log('[maersk-refresh] Using Chrome at:', executablePath)
    }

    try {
      browser = await puppeteerExtra.launch(launchOpts)
    } catch (e) {
      console.error('[maersk-refresh] Browser launch failed:', e)
      return new Response(
        JSON.stringify({
          error: 'Browser launch failed',
          details: String(e),
          hint: 'Install Chrome/Chromium or set CHROME_PATH'
        }),
        { status: 500 }
      )
    }

    const page = await browser.newPage()

    // Set realistic user agent and headers
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

    // Additional stealth: override webdriver, plugins, languages
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false })
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
      // @ts-ignore
      window.chrome = { runtime: {} }
      // @ts-ignore
      delete navigator.__proto__.webdriver
    })

    // Create CDP session for network interception
    const cdpClient = await page.createCDPSession()
    await cdpClient.send('Network.enable')

    // Capture state
    const captureState: { data: CapturedData | null } = { data: null }
    const reqMap = new Map<string, any>()

    // Listen for requests
    cdpClient.on('Network.requestWillBeSent', (evt: any) => {
      try {
        const r = evt.request
        if (r && r.url) {
          reqMap.set(evt.requestId, {
            url: r.url,
            method: r.method,
            headers: r.headers,
            postData: r.postData
          })
        }
      } catch (e) { /* ignore */ }
    })

    // Listen for responses - capture the tracking API response
    cdpClient.on('Network.responseReceived', async (evt: any) => {
      try {
        const respUrl = evt.response?.url
        if (respUrl && respUrl.includes('/synergy/tracking/') && respUrl.includes(container)) {
          console.log('[maersk-refresh] CDP captured response:', respUrl, 'status:', evt.response.status)
          
          try {
            // Get response body
            const bodyResult = await cdpClient.send('Network.getResponseBody', { requestId: evt.requestId })
            const body = bodyResult.base64Encoded 
              ? Buffer.from(bodyResult.body, 'base64').toString('utf8')
              : bodyResult.body

            // Get request info
            const reqInfo = reqMap.get(evt.requestId) || {}

            // Get telemetry from page
            let telemetry: string | null = null
            try {
              telemetry = await page.evaluate(() => {
                try {
                  const b = (window as any).bmak
                  if (b && typeof b.get_telemetry === 'function') return b.get_telemetry()
                } catch (e) {}
                return null
              })
            } catch (e) {
              telemetry = null
            }

            // Get cookies
            const cookies = await page.cookies()
            const userAgent = await page.evaluate(() => navigator.userAgent)

            captureState.data = {
              url: respUrl,
              method: reqInfo.method || 'GET',
              headers: reqInfo.headers || {},
              postData: reqInfo.postData,
              status: evt.response.status,
              body,
              cookies,
              userAgent,
              telemetry,
              timestamp: new Date().toISOString()
            }
          } catch (e) {
            console.error('[maersk-refresh] Error getting response body:', e)
          }
        }
      } catch (e) { /* ignore */ }
    })

    // Warmup: visit homepage first
    console.log('[maersk-refresh] Warmup: visiting homepage')
    try {
      await page.goto('https://www.maersk.com', { waitUntil: 'domcontentloaded', timeout: 15000 })
      await delay(1500 + Math.random() * 1000)
      
      // Random mouse movements
      await page.mouse.move(100 + Math.random() * 200, 100 + Math.random() * 200)
      await delay(300 + Math.random() * 200)
      await page.mouse.move(400 + Math.random() * 300, 200 + Math.random() * 200)
    } catch (e) {
      console.warn('[maersk-refresh] Warmup failed, continuing:', e)
    }

    // Navigate to tracking page
    const trackingUrl = `https://www.maersk.com/tracking/${container}`
    console.log('[maersk-refresh] Navigating to:', trackingUrl)

    // Human-like delay
    await delay(800 + Math.random() * 400)

    try {
      await page.goto(trackingUrl, { waitUntil: 'networkidle0', timeout: timeoutMs })
    } catch (e) {
      console.warn('[maersk-refresh] Navigation timeout, checking if we captured response')
    }

    // Wait for potential late API calls
    await delay(2000 + Math.random() * 1000)

    // Simulate human interaction
    try {
      await page.mouse.move(300, 200)
      await delay(200)
      await page.evaluate(() => window.scrollBy(0, 100))
      await delay(300 + Math.random() * 200)
    } catch (e) { /* ignore */ }

    // Wait a bit more for the API call
    if (!captureState.data) {
      console.log('[maersk-refresh] Waiting for API response...')
      await delay(3000)
    }

    // If still no capture, try waiting for bmak telemetry and response
    if (!captureState.data) {
      try {
        await page.waitForFunction(
          () => (window as any).bmak && typeof (window as any).bmak.get_telemetry === 'function',
          { timeout: 10000 }
        )
        await delay(2000)
      } catch (e) {
        console.debug('[maersk-refresh] bmak not found')
      }
    }

    // Hold mode
    if (hold) {
      console.log('[maersk-refresh] HOLD mode - browser stays open. Press Ctrl+C to exit.')
      await new Promise(() => {}) // never resolves
    }

    // Close browser
    if (!hold && browser) {
      try {
        await browser.close()
        browser = null
      } catch (e) {
        console.warn('[maersk-refresh] Error closing browser:', e)
      }
    }

    // Check if we captured data
    if (!captureState.data) {
      return new Response(
        JSON.stringify({
          error: 'No API response captured',
          hint: 'The page did not make a request to /synergy/tracking/. Try with ?hold=1 to inspect manually.',
          expectedUrl: `https://api.maersk.com/synergy/tracking/${container}`
        }),
        { status: 502 }
      )
    }

    const captured = captureState.data

    // Check for Akamai block
    if (captured.status === 403 || captured.body.includes('Access Denied')) {
      const diagnostics = {
        request: {
          url: captured.url,
          method: captured.method,
          headers: captured.headers
        },
        cookies: captured.cookies.map((c: any) => ({ name: c.name, value: c.value, domain: c.domain })),
        userAgent: captured.userAgent,
        telemetry: captured.telemetry ? captured.telemetry.substring(0, 100) + '...' : null,
        capturedAt: captured.timestamp,
        source: 'puppeteer-cdp',
        response: {
          status: captured.status
        },
        blockedResponse: captured.body
      }
      fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')

      return new Response(
        JSON.stringify({
          error: 'Access Denied by Akamai',
          hint: 'Try with a warmed Chrome profile:\n1. Create profile: mkdir -p /tmp/maersk-profile\n2. Visit Maersk manually: google-chrome --user-data-dir=/tmp/maersk-profile https://www.maersk.com\n3. Click around, solve any CAPTCHAs\n4. Close Chrome\n5. Call API with ?userDataDir=/tmp/maersk-profile',
          diagnostics: {
            status: captured.status,
            url: captured.url,
            cookiesPresent: captured.cookies.length,
            telemetryPresent: !!captured.telemetry,
            userDataDir: userDataDir || 'none (ephemeral)'
          }
        }),
        { status: 403 }
      )
    }

    // Parse JSON
    let parsedJson: any = null
    try {
      parsedJson = JSON.parse(captured.body)
    } catch (e) {
      if (captured.body.includes('<HTML>') || captured.body.includes('<!DOCTYPE')) {
        return new Response(
          JSON.stringify({
            error: 'Received HTML instead of JSON',
            status: captured.status
          }),
          { status: 502 }
        )
      }
    }

    // Write captured JSON
    const outputContent = parsedJson 
      ? JSON.stringify(parsedJson, null, 2) 
      : captured.body
    fs.writeFileSync(jsonPath, outputContent, 'utf-8')
    console.log(`[maersk-refresh] Wrote ${path.relative(projectRoot, jsonPath)} (${outputContent.length} bytes)`)

    // Write diagnostics
    const diagnostics = {
      request: {
        url: captured.url,
        method: captured.method,
        headers: captured.headers
      },
      cookies: captured.cookies.map((c: any) => ({ name: c.name, value: c.value, domain: c.domain })),
      userAgent: captured.userAgent,
      telemetry: captured.telemetry ? captured.telemetry.substring(0, 100) + '...' : null,
      capturedAt: captured.timestamp,
      source: 'puppeteer-cdp',
      response: {
        status: captured.status
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
        bytesWritten: outputContent.length
      }),
      { status: 200 }
    )

  } catch (err: any) {
    console.error('[maersk-refresh] Error:', err)

    // Cleanup
    if (!hold && browser) {
      try { await browser.close() } catch (e) { /* ignore */ }
    }

    return new Response(
      JSON.stringify({ error: String(err), stack: err.stack }),
      { status: 500 }
    )
  }
}

export const POST = GET
