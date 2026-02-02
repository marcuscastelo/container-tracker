import fs from 'fs'
import path from 'path'

// Simple helper to recursively walk a directory
function walk(dir: string): string[] {
  const out: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function parseCurl(content: string) {
  // url
  const urlMatch = content.match(/curl\s+['"]([^'"\s]+)['"]/)
  const url = urlMatch ? urlMatch[1] : null

  // method
  let method = 'GET'
  if (/\s-X\s+POST/.test(content) || /--data-raw|--data|-d/.test(content)) method = 'POST'

  // headers
  const headers: Record<string, string> = {}
  const headerRegex = /-H\s+'([^:]+):\s*([^']*)'/g
  let hmatch
  while ((hmatch = headerRegex.exec(content)) !== null) {
    headers[hmatch[1].trim()] = hmatch[2].trim()
  }

  // body
  let body: string | undefined = undefined
  const dataMatch = content.match(/--data-raw\s+'([\s\S]*?)'/) || content.match(/--data\s+'([\s\S]*?)'/) || content.match(/-d\s+'([\s\S]*?)'/)
  if (dataMatch) body = dataMatch[1]

  return { url, method, headers, body }
}

export async function POST({ request }: any) {
  try {
    const body = await request.json().catch(() => ({}))
    const container = body?.container
    if (!container) return new Response(JSON.stringify({ error: 'container required' }), { status: 400 })

    const projectRoot = process.cwd()
    const collectionsDir = path.join(projectRoot, 'collections')
    if (!fs.existsSync(collectionsDir)) return new Response(JSON.stringify({ error: 'collections directory not found' }), { status: 500 })

    const files = walk(collectionsDir)
    const txt = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.txt'))
    const json = files.find((f) => path.basename(f).replace(/\.[^.]+$/, '') === String(container) && f.endsWith('.json'))

    if (!txt) return new Response(JSON.stringify({ error: 'curl .txt not found for container', container }), { status: 404 })
    if (!json) return new Response(JSON.stringify({ error: 'json file not found for container', container }), { status: 404 })

    const curlContent = fs.readFileSync(txt, 'utf-8')
    // determine provider folder (collections/<provider>/<file>.txt)
    const relTxt = path.relative(projectRoot, txt).replace(/\\/g, '/')
    const parts = relTxt.split('/')
    const provider = parts.length >= 2 ? parts[1].toLowerCase() : ''

    // Temporarily disable Maersk until token refresh logic is implemented
    if (provider === 'maersk') {
      return new Response(JSON.stringify({ error: 'refresh for maersk is disabled for now' }), { status: 501 })
    }
    const parsed = parseCurl(curlContent)
    if (!parsed.url) return new Response(JSON.stringify({ error: 'could not parse url from curl' }), { status: 500 })

    console.log(`refresh: provider=${provider} container=${container} url=${parsed.url} method=${parsed.method}`)

    // perform request
    const fetchOpts: any = { method: parsed.method, headers: parsed.headers }
    // For CMA-CGM, prefer uncompressed response to simplify parsing (curl CLI returns plaintext)
    if (provider === 'cmacgm') {
      try {
        fetchOpts.headers = { ...(fetchOpts.headers || {}), 'Accept-Encoding': 'identity' }
      } catch (e) {}
    }
    if (parsed.body) fetchOpts.body = parsed.body

    let res
    try {
      console.log('refresh: performing fetch...')
      res = await fetch(parsed.url, fetchOpts)
      console.log('refresh: fetch returned', res.status, res.statusText)
    } catch (err) {
      console.error('refresh: fetch failed', err)
      return new Response(JSON.stringify({ error: 'fetch failed', details: String(err) }), { status: 502 })
    }

    // Read response as ArrayBuffer and handle possible compressed payloads (gzip/deflate/br).
    let text: string
    try {
      const ab = await res.arrayBuffer()
      let buf = Buffer.from(ab)
      console.log('refresh: raw buffer length', buf.length)
      const ce = (res.headers && (res.headers.get ? res.headers.get('content-encoding') : null)) || null
      try {
        const zlib = await import('zlib')
        if (ce === 'gzip' || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)) {
          try { buf = zlib.gunzipSync(buf); console.log('refresh: decompressed gzip response (by header/signature)') } catch (e) { console.error('refresh: gunzip failed', e) }
        } else if (ce === 'deflate' || (buf.length >= 2 && buf[0] === 0x78 && (buf[1] === 0x9c || buf[1] === 0x01 || buf[1] === 0xda))) {
          try { buf = zlib.inflateSync(buf); console.log('refresh: inflated deflate response (by header/signature)') } catch (e) { console.error('refresh: inflate failed', e) }
        } else if (ce === 'br') {
          try { buf = zlib.brotliDecompressSync(buf); console.log('refresh: brotli-decompressed response') } catch (e) { console.error('refresh: brotli decompress failed', e) }
        }
      } catch (e) {
        console.error('refresh: zlib import failed or not available', e)
      }

      // decode as utf-8 text
      try {
        text = buf.toString('utf-8')
      } catch (e) {
        console.error('refresh: buf.toString failed', e)
        text = ''
      }
      console.log('refresh: decoded text length', text.length)
    } catch (err) {
      console.error('refresh: reading response failed', err)
      return new Response(JSON.stringify({ error: 'reading response failed', details: String(err) }), { status: 502 })
    }

    // try to pretty-print JSON responses
    let outText = text

    // Provider-specific parsing: CMA-CGM returns an HTML page with a script that sets
    // `options.responseData = '<json string>'`. We only need to extract that inner JSON
    // via a regex and unescape the JS string before parsing.
    if (provider === 'cmacgm') {
      try {
        const m = text.match(/options\.responseData\s*=\s*(['"])([\s\S]*?)\1/)
        if (m && m[2]) {
          let inner = m[2]
          // Unescape common JS string escapes so JSON.parse can handle it
          inner = inner.replace(/\\\//g, '/')
                       .replace(/\\n/g, '')
                       .replace(/\\r/g, '')
                       .replace(/\\t/g, '')
                       .replace(/\\'/g, "'")
                       .replace(/\\\"/g, '"')
                       .replace(/\\\\/g, '\\')
          try {
            const parsedJson = JSON.parse(inner)
            outText = JSON.stringify(parsedJson, null, 4)
            console.log('refresh: parsed CMA responseData to JSON')
          } catch (e) {
            console.error('refresh: failed to parse CMA responseData after unescape', e)
            // leave outText as raw HTML if parsing fails
          }
        }
      } catch (err) {
        console.error('refresh: error parsing CMA response', err)
      }
    }

    // If we didn't transform the output (not CMA or parsing failed), attempt to parse body as JSON
    if (outText === text) {
      try {
        const parsedJson = JSON.parse(text)
        outText = JSON.stringify(parsedJson, null, 4)
      } catch (_) {
        // not JSON - keep raw
      }
    }

    // write to json file path
    try {
      fs.writeFileSync(json, outText, 'utf-8')
      console.log(`refresh: wrote ${path.relative(projectRoot, json)} (${outText.length} bytes)`)
    } catch (err) {
      console.error('refresh: write failed', err)
      return new Response(JSON.stringify({ error: 'write failed', details: String(err) }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, updatedPath: path.relative(projectRoot, json) }), { status: 200 })
  } catch (err: any) {
    console.error('refresh error', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
}

export const GET = () => new Response(JSON.stringify({ ok: true }), { status: 200 })
