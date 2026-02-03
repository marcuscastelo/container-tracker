#!/usr/bin/env node
const express = require('express')
const fs = require('fs')
const path = require('path')

const puppeteerExtra = require('puppeteer-extra')
const Stealth = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(Stealth())

const app = express()
const port = process.env.PORT || 4300
app.use(express.json({ limit: '10mb' }))

function findSystemChrome() {
  const envPath = process.env.CHROME_PATH || process.env.CHROMIUM_PATH
  if (envPath && fs.existsSync(envPath)) return envPath
  const platform = process.platform
  const candidates = []
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
  for (const c of candidates) if (fs.existsSync(c)) return c
  return null
}

app.all('/api/refresh-maersk/:container', async (req, res) => {
  const container = req.params.container
  if (!container) return res.status(400).json({ error: 'container required' })

  const projectRoot = process.cwd()
  const collectionsDir = path.join(projectRoot, 'collections')
  if (!fs.existsSync(collectionsDir)) return res.status(500).json({ error: 'collections directory not found' })

  const providerDir = path.join(collectionsDir, 'maersk')
  if (!fs.existsSync(providerDir)) fs.mkdirSync(providerDir, { recursive: true })
  const jsonPath = path.join(providerDir, `${container}.json`)
  const diagnosticsPath = path.join(providerDir, `${container}.json.devtools.json`)

  // Launch puppeteer-extra
  let browser = null
  try {
    const launchOpts = { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }
    const chrome = findSystemChrome()
    if (chrome) launchOpts.executablePath = chrome
    // default headless true unless ?headless=0
    if (req.query && (req.query.headless === '0' || req.query.headless === 'false')) launchOpts.headless = false
    else launchOpts.headless = true

    browser = await puppeteerExtra.launch(launchOpts)
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

    const cdp = await page.target().createCDPSession()
    await cdp.send('Network.enable')

    const reqMap = new Map()
    let captured = null

    cdp.on('Network.requestWillBeSent', (evt) => {
      try { reqMap.set(evt.requestId, { url: evt.request?.request?.url || evt.request?.url, method: evt.request?.request?.method || evt.request?.method, headers: evt.request?.request?.headers || evt.request?.headers, postData: evt.request?.request?.postData }) } catch (e) {}
    })

    cdp.on('Network.responseReceived', async (evt) => {
      try {
        const respUrl = evt.response?.url || evt.response?.response?.url
        if (!respUrl) return
        if (respUrl.includes('/synergy/tracking/') && respUrl.includes(container)) {
          try {
            const bodyRes = await cdp.send('Network.getResponseBody', { requestId: evt.requestId })
            const body = bodyRes.base64Encoded ? Buffer.from(bodyRes.body, 'base64').toString('utf8') : bodyRes.body
            const reqInfo = reqMap.get(evt.requestId) || {}
            const cookies = await page.cookies()
            const userAgent = await page.evaluate(() => navigator.userAgent)
            captured = { url: respUrl, method: reqInfo.method || 'GET', headers: reqInfo.headers || {}, postData: reqInfo.postData, status: evt.response?.status || evt.response?.response?.status, body, cookies, userAgent, timestamp: new Date().toISOString() }
          } catch (e) { console.error('Error getting response body', e) }
        }
      } catch (e) {}
    })

    // Visit maersk and tracking page
    try { await page.goto('https://www.maersk.com', { waitUntil: 'domcontentloaded', timeout: 15000 }) } catch (e) {}
    try { await page.goto(`https://www.maersk.com/tracking/${container}`, { waitUntil: 'networkidle2', timeout: 60000 }) } catch (e) { console.warn('navigation timeout', e) }
    // wait for potential API call
    await new Promise((r) => setTimeout(r, 3000))

    if (!captured) {
      // give a little more time
      await new Promise((r) => setTimeout(r, 3000))
    }

    if (!captured) {
      // close and return 502
      try { await browser.close() } catch (e) {}
      return res.status(502).json({ error: 'No API response captured', hint: 'Try running with headless=0 and inspect manual flow' })
    }

    // parse JSON if possible
    let out = captured.body
    try { const parsed = JSON.parse(captured.body); out = JSON.stringify(parsed, null, 2) } catch (e) {}

    fs.writeFileSync(jsonPath, out, 'utf-8')
    const diagnostics = { request: { url: captured.url, method: captured.method, headers: captured.headers }, cookies: captured.cookies.map((c) => ({ name: c.name, value: c.value, domain: c.domain })), userAgent: captured.userAgent, timestamp: captured.timestamp, status: captured.status }
    fs.writeFileSync(diagnosticsPath, JSON.stringify(diagnostics, null, 2), 'utf-8')

    try { await browser.close() } catch (e) {}

    return res.json({ ok: true, updatedPath: path.relative(projectRoot, jsonPath), diagnosticsPath: path.relative(projectRoot, diagnosticsPath), status: captured.status })
  } catch (err) {
    console.error('maersk server error', err)
    try { if (browser) await browser.close() } catch (e) {}
    return res.status(500).json({ error: String(err) })
  }
})

app.get('/', (_req, res) => res.json({ ok: true, server: 'maersk-server' }))

app.listen(port, () => console.log(`Maersk server listening on http://localhost:${port}`))
