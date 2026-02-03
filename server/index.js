import express from 'express'
import fs from 'fs'
import path from 'path'

const app = express()
const port = process.env.PORT || 3000

app.use(express.json({ limit: '5mb' }))

// Serve static client built by vinxi
const clientDir = path.join(process.cwd(), '.vinxi', 'build', 'client', '_build')
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir))
} else {
  // If client build not present, serve a minimal placeholder
  app.get('/', (_req, res) => {
    res.type('html').send('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Container Tracker</title></head><body><div id="app">Build not found. Run `pnpm run build`.</div></body></html>')
  })
}

// Helper to recursively walk a directory
function walk(dir) {
  const out = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function parseCurl(content) {
  const urlMatch = content.match(/curl\s+['"]([^'"\s]+)['"]/)
  const url = urlMatch ? urlMatch[1] : null
  let method = 'GET'
  if (/\s-X\s+POST/.test(content) || /--data-raw|--data|-d/.test(content)) method = 'POST'
  const headers = {}
  const headerRegex = /-H\s+'([^:]+):\s*([^']*)'/g
  let hmatch
  while ((hmatch = headerRegex.exec(content)) !== null) {
    headers[hmatch[1].trim()] = hmatch[2].trim()
  }
  let body = undefined
  const dataMatch = content.match(/--data-raw\s+'([\s\S]*?)'/) || content.match(/--data\s+'([\s\S]*?)'/) || content.match(/-d\s+'([\s\S]*?)'/)
  if (dataMatch) body = dataMatch[1]
  return { url, method, headers, body }
}

app.get('/api/refresh', (_req, res) => res.json({ ok: true }))

app.post('/api/refresh', async (req, res) => {
  try {
    const body = req.body || {}
    const container = body.container
    if (!container) return res.status(400).json({ error: 'container required' })

    const projectRoot = process.cwd()
    const collectionsDir = path.join(projectRoot, 'collections')
    if (!fs.existsSync(collectionsDir)) return res.status(500).json({ error: 'collections directory not found' })

    const files = walk(collectionsDir)
    const txt = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.txt'))
    const json = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.json'))

    if (!txt) return res.status(404).json({ error: 'curl .txt not found for container', container })
    if (!json) return res.status(404).json({ error: 'json file not found for container', container })

    const curlContent = fs.readFileSync(txt, 'utf-8')
    const relTxt = path.relative(projectRoot, txt).replace(/\\/g, '/')
    const parts = relTxt.split('/')
    const provider = parts.length >= 2 ? parts[1].toLowerCase() : ''

    if (provider === 'maersk') {
      const redirectPath = `/api/refresh-maersk/${encodeURIComponent(String(container))}`
      res.status(307).location(redirectPath).json({ redirect: redirectPath })
      return
    }

    const parsed = parseCurl(curlContent)
    if (!parsed.url) return res.status(500).json({ error: 'could not parse url from curl' })

    console.debug(`refresh: provider=${provider} container=${container} url=${parsed.url} method=${parsed.method}`)

    const fetchOpts = { method: parsed.method, headers: parsed.headers }
    if (provider === 'cmacgm') {
      try { fetchOpts.headers = { ...(fetchOpts.headers || {}), 'Accept-Encoding': 'identity' } } catch (e) {}
    }
    if (parsed.body) fetchOpts.body = parsed.body

    let response
    try {
      response = await fetch(parsed.url, fetchOpts)
    } catch (err) {
      console.error('refresh: fetch failed', err)
      return res.status(502).json({ error: 'fetch failed', details: String(err) })
    }

    let text
    try {
      const ab = await response.arrayBuffer()
      let buf = Buffer.from(ab)
      const ce = (response.headers && (response.headers.get ? response.headers.get('content-encoding') : null)) || null
      try {
        const zlib = await import('zlib')
        if (ce === 'gzip' || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)) {
          try { buf = zlib.gunzipSync(buf) } catch (e) { console.error('gunzip failed', e) }
        } else if (ce === 'deflate' || (buf.length >= 2 && buf[0] === 0x78 && (buf[1] === 0x9c || buf[1] === 0x01 || buf[1] === 0xda))) {
          try { buf = zlib.inflateSync(buf) } catch (e) { console.error('inflate failed', e) }
        } else if (ce === 'br') {
          try { buf = zlib.brotliDecompressSync(buf) } catch (e) { console.error('brotli failed', e) }
        }
      } catch (e) { console.error('zlib import failed', e) }
      try { text = buf.toString('utf-8') } catch (e) { text = '' }
    } catch (err) {
      console.error('refresh: reading response failed', err)
      return res.status(502).json({ error: 'reading response failed', details: String(err) })
    }

    let outText = text
    if (provider === 'cmacgm') {
      try {
        const m = text.match(/options\.responseData\s*=\s*(['"])([\s\S]*?)\1/)
        if (m && m[2]) {
          let inner = m[2]
          inner = inner.replace(/\\\//g, '/').replace(/\\n/g, '').replace(/\\r/g, '').replace(/\\t/g, '').replace(/\\'/g, "'").replace(/\\\"/g, '"').replace(/\\\\/g, '\\')
          try { const parsedJson = JSON.parse(inner); outText = JSON.stringify(parsedJson, null, 4); console.log('parsed CMA response') } catch (e) { console.error('parse CMA failed', e) }
        }
      } catch (err) { console.error('refresh: error parsing CMA response', err) }
    }

    if (outText === text) {
      try { const parsedJson = JSON.parse(text); outText = JSON.stringify(parsedJson, null, 4) } catch (_) {}
    }

    try {
      fs.writeFileSync(json, outText, 'utf-8')
      console.log(`refresh: wrote ${path.relative(projectRoot, json)} (${outText.length} bytes)`)
    } catch (err) {
      console.error('refresh: write failed', err)
      return res.status(500).json({ error: 'write failed', details: String(err) })
    }

    return res.json({ ok: true, updatedPath: path.relative(projectRoot, json) })
  } catch (err) {
    console.error('refresh error', err)
    return res.status(500).json({ error: String(err) })
  }
})

// maersk handler: return 501 unless puppeteer is installed and configured
app.all('/api/refresh-maersk/:container', (_req, res) => {
  res.status(501).json({ error: 'Maersk handler requires puppeteer and is not available in the bundled server. Run the app in dev or add puppeteer to the server.' })
})

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const indexHtml = path.join(clientDir, 'index.html')
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml)
  // otherwise return a minimal shell that loads the client assets if present
  if (fs.existsSync(clientDir)) {
    // try to find client CSS and JS from assets
    const assetsDir = path.join(clientDir, 'assets')
    let css = null
    let js = null
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir)
      css = files.find((f) => f.endsWith('.css'))
      js = files.find((f) => f.endsWith('.js'))
    }
    return res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Container Tracker</title>${css?`<link rel="stylesheet" href="/assets/${css}">`:''}</head><body><div id="app"></div>${js?`<script type="module" src="/assets/${js}"></script>`:''}</body></html>`)
  }
  res.status(404).send('Not found')
})

app.listen(port, () => console.log(`Server listening on http://localhost:${port}`))
