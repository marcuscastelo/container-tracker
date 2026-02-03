import { containerStatusUseCases } from '~/modules/container'
import { z } from 'zod'

// Explicit request/response schemas for this API
export const RefreshRequestSchema = z.object({
  container: z.string(),
  carrier: z.string().optional().nullable(),
}).strict()

export const RefreshSuccessResponseSchema = z.object({ ok: z.literal(true), container: z.string() })
export const RefreshRedirectResponseSchema = z.object({ redirect: z.string() })
export const RefreshResponseSchema = z.union([RefreshSuccessResponseSchema, RefreshRedirectResponseSchema])
export const RefreshErrorResponseSchema = z.object({ error: z.string() })

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>
export type RefreshErrorResponse = z.infer<typeof RefreshErrorResponseSchema>

// Health response schema for GET
export const RefreshHealthResponseSchema = z.object({ ok: z.literal(true) })
export type RefreshHealthResponse = z.infer<typeof RefreshHealthResponseSchema>

// Helper to validate payloads against schemas and return Response
function respondWithSchema<T>(payload: T, schema: z.ZodTypeAny, status = 200, extraHeaders?: Record<string,string>) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.error('refresh: response validation failed', parsed.error.format())
    return new Response(JSON.stringify({ error: 'response validation failed' }), { status: 500 })
  }
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  return new Response(JSON.stringify(parsed.data), { status, headers })
}

// Simple helper to recursively walk a directory
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
    const rawBody = await request.json().catch(() => ({}))
    const parsedReq = RefreshRequestSchema.safeParse(rawBody)
    if (!parsedReq.success) return respondWithSchema({ error: `invalid request: ${parsedReq.error.message}` }, RefreshErrorResponseSchema, 400)
    const container = parsedReq.data.container
    const provider = parsedReq.data.carrier || 'unknown'
    // Fetch container record from DB
    const rec = await containerStatusUseCases.getContainerStatus(String(container))
    if (!rec) return new Response(JSON.stringify({ error: 'container not found in DB', container }), { status: 404 })

    // Hardcoded curl templates per carrier. Templates may include {container} placeholder.
    const CURL_TEMPLATES: Record<string, string> = {
      maersk: `curl 'https://api.maersk.com/synergy/tracking/{container}?operator=MAEU' \
  --compressed \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0' \
  -H 'Accept: application/json' \
  -H 'Accept-Language: en-US,en;q=0.5' \
  -H 'Accept-Encoding: gzip, deflate, br, zstd' \
  -H 'Referer: https://www.maersk.com/' \
  -H 'Consumer-Key: UtMm6JCDcGTnMGErNGvS2B98kt1Wl25H' \
  -H 'API-Version: v2' \
  -H 'Connection: keep-alive' \
  -H 'TE: trailers'`,

      cmacgm: `curl 'https://www.cma-cgm.com/ebusiness/tracking/search' \
  --compressed \
  -X POST \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0' \
  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' \
  -H 'Accept-Language: en-US,en;q=0.5' \
  -H 'Accept-Encoding: gzip, deflate, br, zstd' \
  -H 'Referer: https://www.cma-cgm.com/ebusiness/tracking' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'Origin: https://www.cma-cgm.com' \
  -H 'Connection: keep-alive' \
  --data-raw '__RequestVerificationToken=PLACEHOLDER&SearchViewModel.SearchBy=Container&SearchViewModel.Reference={container}&SearchViewModel.FromHome=true&search='`,

      msc: `curl 'https://www.msc.com/api/feature/tools/TrackingInfo' \
  --compressed \
  -X POST \
  -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Accept-Language: en-US,en;q=0.5' \
  -H 'Accept-Encoding: gzip, deflate, br, zstd' \
  -H 'Referer: https://www.msc.com/en/track-a-shipment' \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -H 'Origin: https://www.msc.com' \
  -H 'Connection: keep-alive' \
  --data-raw '{"trackingNumber":"{container}","trackingMode":"0"}'`,
    }

    // If provider is Maersk we keep the existing redirect to the puppeteer handler
    if (provider === 'maersk') {
      const redirectPath = `/api/refresh-maersk/${encodeURIComponent(String(container))}`
      const redirectPayload = { redirect: redirectPath }
      if (RefreshRedirectResponseSchema.safeParse(redirectPayload).success) {
        return new Response(JSON.stringify(redirectPayload), { status: 307, headers: { Location: redirectPath, 'Content-Type': 'application/json' } })
      }
      return respondWithSchema(redirectPayload, RefreshRedirectResponseSchema, 307, { Location: redirectPath })
    }

    const template = CURL_TEMPLATES[provider] ?? CURL_TEMPLATES[provider.split('-')[0]] ?? null
    if (!template) {
      console.error(`refresh: no curl template for carrier '${provider}'`)
      return respondWithSchema({ error: `no curl template for carrier ${provider}` }, RefreshErrorResponseSchema, 400)
    }

    const curlContent = template.replace(/\{container\}/g, String(container))
    const parsed = parseCurl(curlContent)
    if (!parsed.url) return respondWithSchema({ error: 'could not parse url from curl' }, RefreshErrorResponseSchema, 500)

    console.debug(`refresh: provider=${provider} container=${container} url=${parsed.url} method=${parsed.method}`)
    console.debug('refresh: fetchOpts.headers preview', Object.keys(parsed.headers || {}).slice(0,20))

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
      console.debug('refresh: performing fetch...')
      res = await fetch(parsed.url, fetchOpts)
      console.debug('refresh: fetch returned', res.status, res.statusText)
      console.debug('refresh: response headers', {
        'content-type': res.headers.get && res.headers.get('content-type'),
        'content-encoding': res.headers.get && res.headers.get('content-encoding'),
        'content-length': res.headers.get && res.headers.get('content-length'),
      })
    } catch (err) {
      console.error('refresh: fetch failed', err)
      return respondWithSchema({ error: `fetch failed: ${String(err)}` }, RefreshErrorResponseSchema, 502)
    }

    // Read response as ArrayBuffer and handle possible compressed payloads (gzip/deflate/br).
    let text: string
    try {
      const ab = await res.arrayBuffer()
      let buf = Buffer.from(ab)
      console.debug('refresh: raw buffer length', buf.length)
      try {
        const previewHex = buf.slice(0, 64).toString('hex')
        const previewUtf = buf.slice(0, 128).toString('utf8')
        console.debug('refresh: raw buffer preview hex', previewHex)
        console.debug('refresh: raw buffer preview utf8 (maybe binary)', previewUtf.replace(/\s+/g, ' '))
      } catch (e) {
        console.debug('refresh: preview conversion failed', String(e))
      }
      const ce = (res.headers && (res.headers.get ? res.headers.get('content-encoding') : null)) || null
      try {
        const zlib = await import('zlib')
        if (ce === 'gzip' || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)) {
          try { buf = zlib.gunzipSync(buf); console.debug('refresh: decompressed gzip response (by header/signature)') } catch (e) { console.error('refresh: gunzip failed', e) }
        } else if (ce === 'deflate' || (buf.length >= 2 && buf[0] === 0x78 && (buf[1] === 0x9c || buf[1] === 0x01 || buf[1] === 0xda))) {
          try { buf = zlib.inflateSync(buf); console.debug('refresh: inflated deflate response (by header/signature)') } catch (e) { console.error('refresh: inflate failed', e) }
        } else if (ce === 'br') {
          try { buf = zlib.brotliDecompressSync(buf); console.debug('refresh: brotli-decompressed response') } catch (e) { console.error('refresh: brotli decompress failed', e) }
        } else {
          console.debug('refresh: no compression detected by header or signature; content-encoding=', ce)
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
      console.debug('refresh: decoded text length', text.length)
      console.debug('refresh: decoded text preview', text.slice(0, 500).replace(/\s+/g, ' '))
    } catch (err) {
      console.error('refresh: reading response failed', err)
      return respondWithSchema({ error: `reading response failed: ${String(err)}` }, RefreshErrorResponseSchema, 502)
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
    let parsedStatus: Record<string, unknown> = {}
    if (outText === text) {
      try {
        parsedStatus = JSON.parse(text)
        outText = JSON.stringify(parsedStatus, null, 4)
      } catch (_) {
        // not JSON - keep raw, wrap in status object
        parsedStatus = { raw: text }
      }
    } else {
      try {
        parsedStatus = JSON.parse(outText)
      } catch (_) {
        parsedStatus = { raw: outText }
      }
    }

    // Save to Supabase instead of filesystem
    try {
      await containerStatusUseCases.saveContainerStatus(String(container), parsedStatus)
      console.log(`refresh: saved container ${container} to Supabase`)
    } catch (err) {
      console.error('refresh: Supabase save failed', err)
      return respondWithSchema({ error: `Supabase save failed: ${String(err)}` }, RefreshErrorResponseSchema, 500)
    }

    return respondWithSchema({ ok: true, container: String(container) }, RefreshSuccessResponseSchema, 200)
  } catch (err: any) {
    console.error('refresh error', err)
    return respondWithSchema({ error: String(err) }, RefreshErrorResponseSchema, 500)
  }
}

export const GET = () => respondWithSchema({ ok: true }, RefreshHealthResponseSchema, 200)
