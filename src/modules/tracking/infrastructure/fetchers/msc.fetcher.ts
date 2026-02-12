import zlib from 'node:zlib'
import axios from 'axios'
import type { Provider } from '~/modules/tracking/domain/provider'

export type FetchResult = {
  readonly provider: Provider
  readonly payload: unknown
  readonly fetchedAt: string
}

/**
 * Fetch tracking data from MSC's TrackingInfo API endpoint.
 *
 * Returns the raw parsed JSON (or raw text wrapped in an object) for
 * downstream snapshot persistence and normalization.
 */
export async function fetchMscStatus(containerNumber: string): Promise<FetchResult> {
  const url = 'https://www.msc.com/api/feature/tools/TrackingInfo'
  const body = {
    trackingNumber: String(containerNumber),
    trackingMode: '0',
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    Referer: 'https://www.msc.com/en/track-a-shipment',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    Origin: 'https://www.msc.com',
    'Sec-GPC': '1',
    Connection: 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    Priority: 'u=0',
    TE: 'trailers',
  }

  const resp = await axios.post(url, body, {
    headers,
    responseType: 'arraybuffer',
    timeout: 30_000,
  })

  const contentEncoding: string | undefined = resp.headers?.['content-encoding'] ?? undefined
  const text = decodeResponseBuffer(
    Buffer.from(resp.data),
    typeof contentEncoding === 'string' ? contentEncoding : null,
  )

  const payload = tryParseJson(text)

  return {
    provider: 'msc',
    payload,
    fetchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeResponseBuffer(buf: Buffer, contentEncoding: string | null): string {
  try {
    if (contentEncoding === 'gzip' || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)) {
      return zlib.gunzipSync(buf).toString('utf8')
    }
    if (
      contentEncoding === 'deflate' ||
      (buf.length >= 2 &&
        buf[0] === 0x78 &&
        (buf[1] === 0x9c || buf[1] === 0x01 || buf[1] === 0xda))
    ) {
      return zlib.inflateSync(buf).toString('utf8')
    }
    if (contentEncoding === 'br') {
      return zlib.brotliDecompressSync(buf).toString('utf8')
    }
  } catch {
    // fallback
  }

  return buf.toString('utf8')
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { raw_text: text }
  }
}
