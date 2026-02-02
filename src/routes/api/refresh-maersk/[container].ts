import fs from 'fs'
import path from 'path'

// Minimal curl parser (same heuristics as existing refresh.ts)
function parseCurl(content: string) {
  const urlMatch = content.match(/curl\s+['"]([^'"\s]+)['"]/)
  const url = urlMatch ? urlMatch[1] : null

  let method = 'GET'
  if (/\s-X\s+POST/.test(content) || /--data-raw|--data|-d/.test(content)) method = 'POST'

  const headers: Record<string, string> = {}
  const headerRegex = /-H\s+'([^:]+):\s*([^']*)'/g
  let hmatch
  while ((hmatch = headerRegex.exec(content)) !== null) {
    headers[hmatch[1].trim()] = hmatch[2].trim()
  }

  return { url, method, headers }
}

export async function GET({ params }: any) {
  try {
    const container = params?.container
    if (!container) return new Response(JSON.stringify({ error: 'container param required' }), { status: 400 })

    const projectRoot = process.cwd()
    const collectionsDir = path.join(projectRoot, 'collections')
    if (!fs.existsSync(collectionsDir)) return new Response(JSON.stringify({ error: 'collections directory not found' }), { status: 500 })

    // find files for container
    const files: string[] = []
    function walk(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const ent of entries) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(full)
        else files.push(full)
      }
    }
    walk(collectionsDir)

    const txt = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.txt'))
    const json = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.json'))

    if (!txt) return new Response(JSON.stringify({ error: 'curl .txt not found for container', container }), { status: 404 })
    if (!json) return new Response(JSON.stringify({ error: 'json file not found for container', container }), { status: 404 })

    const curlContent = fs.readFileSync(txt, 'utf-8')
    const parsed = parseCurl(curlContent)
    if (!parsed.url) return new Response(JSON.stringify({ error: 'could not parse url from curl' }), { status: 500 })

    // ensure this route is only for maersk
    const relTxt = path.relative(projectRoot, txt).replace(/\\/g, '/')
    const parts = relTxt.split('/')
    const provider = parts.length >= 2 ? parts[1].toLowerCase() : ''
    if (provider !== 'maersk') return new Response(JSON.stringify({ error: 'not a maersk provider file' }), { status: 400 })

    // Try to import playwright dynamically; if missing, instruct user to install
    let playwright: any = null
    try {
      // prefer playwright (bundles browsers via postinstall)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      playwright = require('playwright')
    } catch (e) {
      return new Response(JSON.stringify({ error: 'playwright not installed', hint: 'npm i -D playwright' }), { status: 500 })
    }

    const chromium = playwright.chromium

    // Launch browser. For debugging we show the UI; set env HEADLESS=1 to run headless
    const headless = process.env.HEADLESS === '1' || process.env.HEADLESS === 'true'
    const launchArgs: string[] = []
    // add no-sandbox flags to help run in Linux dev containers
    launchArgs.push('--no-sandbox', '--disable-setuid-sandbox')

    const browser = await chromium.launch({ headless: !!headless, args: launchArgs })
    const context = await browser.newContext({
      // mimic a standard desktop UA to reduce fingerprinting differences
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    })
    const page = await context.newPage()

    const trackingUrl = `https://www.maersk.com/tracking/${container}`
    console.debug('maersk-refresh: navigating to', trackingUrl)
    await page.goto(trackingUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})

    // wait for the bmak object (Akamai) to exist, but don't block forever
    try {
      await page.waitForFunction(() => (window as any).bmak && typeof (window as any).bmak.get_telemetry === 'function', { timeout: 10000 })
    } catch (e) {
      console.debug('maersk-refresh: bmak not found within timeout; continuing')
    }

    // Perform fetch in page context so cookies and JS-generated telemetry are available
    const apiUrl = parsed.url
    console.debug('maersk-refresh: apiUrl', apiUrl)

    const fetchResult = await page.evaluate(async ({ apiUrl, headers }) => {
      try {
        const tel = (window as any).bmak && typeof (window as any).bmak.get_telemetry === 'function' ? (window as any).bmak.get_telemetry() : null
        const h: Record<string, string> = headers || {}
        if (tel) h['Akamai-BM-Telemetry'] = tel
        // ensure referer
        h['Referer'] = 'https://www.maersk.com/'
        const response = await fetch(apiUrl, { method: 'GET', headers: h, credentials: 'include' })
        const contentType = response.headers.get('content-type') || ''
        const status = response.status
        if (contentType.includes('application/json')) {
          const json = await response.json()
          return { ok: true, status, json }
        }
        const text = await response.text()
        return { ok: true, status, text }
      } catch (err) {
        return { ok: false, error: String(err) }
      }
    }, { apiUrl, headers: parsed.headers })

    // close browser
    try { await browser.close() } catch (e) { console.debug('maersk-refresh: browser close failed', e) }

    if (!fetchResult || !fetchResult.ok) {
      return new Response(JSON.stringify({ error: 'fetch failed in browser', details: fetchResult }), { status: 502 })
    }

    // write result to JSON file (pretty print if JSON)
    try {
      let outText = ''
      if (fetchResult.json) outText = JSON.stringify(fetchResult.json, null, 4)
      else if (fetchResult.text) outText = String(fetchResult.text)
      else outText = JSON.stringify(fetchResult)
      fs.writeFileSync(json, outText, 'utf-8')
      console.log(`refresh-maersk: wrote ${path.relative(projectRoot, json)} (${outText.length} bytes)`)
    } catch (err) {
      return new Response(JSON.stringify({ error: 'write failed', details: String(err) }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, updatedPath: path.relative(projectRoot, json) }), { status: 200 })
  } catch (err: any) {
    console.error('refresh-maersk error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}

export const POST = GET
