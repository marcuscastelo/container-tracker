// Provider: MSC
// Implements a POST to MSC's TrackingInfo endpoint. Uses axios to perform the
// request and returns either parsed JSON or raw text.
import axios from 'axios'

export async function fetchStatus(
  container: string,
): Promise<{ parsedStatus?: Record<string, unknown>; raw?: string }> {
  const url = 'https://www.msc.com/api/feature/tools/TrackingInfo'
  const payload = {
    trackingNumber: String(container),
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
    // NOTE: Cookie is preserved from example; you may want to refresh/remove
    // this in real usage.
    Cookie:
      'AKA_A2=A; ak_bmsc=0C4582D18CC5D292DE21997AA72B88AA~000000000000000000000000000000~YAAQyyoRAsjrjwqcAQAAe2jBHx7wcXh0e6C3oXaGDvWtX6i5DOmpgNnVia4uwbhqiV5xhPcxRcji1oMKGfbopn6KLaTaz8F/7ftPy0vMAg5/teHXm3nCgCtCe5tEwvm1qvQ5DdqfNa/h6nbeQtpaDJFVfF+XvtNWD8yIpRjwvBAmqie21Ol+StIYzmbwAM0vY3Yrklh320pGmlATUOC7wAe7DYeMHV5slXtaG0lYSUr/eHwyPL0x+qIZd9vXFpn0QpgGDp5ziHi+TwnOq4bsGd06RRxbEGjMuOMU+SuPficqQQW8n53xFQ/iC+gobN8OxAsUvqusPsC7fR834a9JEYupYhOPh2h3EPpPVZMfqIMWmGkFBud1VksF2btnxKKmMFzwgQXGeXeePg==; OptanonConsent=isGpcEnabled=1&datestamp=Mon+Feb+02+2026+16%3A30%3A48+GMT-0300+(Brasilia+Standard+Time)&version=202509.1.0&browserGpcFlag=1&isIABGlobal=false&identifierType=&hosts=&consentId=ed88da98-506c-44c5-b191-9913e1da05db&interactionCount=1&isAnonUser=1&landingPath=NotLandingPage&groups=C0002%3A1%2CC0004%3A1%2CC0003%3A1%2CC0001%3A1&iType=1&intType=1&geolocation=BR%3BSP&AwaitingReconsent=false; OptanonAlertBoxClosed=2026-02-02T19:08:22.301Z; _gcl_au=1.1.884143518.1770059302; jcoPageCount=4; msccargo#lang=en; currentLocation=BR; shell#lang=en; ASP.NET_SessionId=2bppn5stu1d2myx2fz5dww1b; SC_ANALYTICS_GLOBAL_COOKIE=cfaf5d82d34b4848adffa823a02320a9|False; isLoggedUser=false; currentAgency=842',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    Priority: 'u=0',
    TE: 'trailers',
  }

  let resp
  try {
    // Request as arraybuffer so we can handle decompression explicitly if needed
    resp = await axios.post(url, payload, {
      headers,
      responseType: 'arraybuffer',
    })
  } catch (err) {
    throw new Error(`msc.fetchStatus: network error: ${String((<Error>err)?.message ?? err)}`)
  }

  const data = resp.data
  let text = ''
  try {
    const buf = Buffer.from(data)
    // Attempt to decode/decompress like CMA handler
    const contentEncoding = (resp.headers && resp.headers['content-encoding']) || null
    try {
      const zlib = await import('zlib')
      if (contentEncoding === 'gzip' || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)) {
        text = zlib.gunzipSync(buf).toString('utf8')
      } else if (
        contentEncoding === 'deflate' ||
        (buf.length >= 2 &&
          buf[0] === 0x78 &&
          (buf[1] === 0x9c || buf[1] === 0x01 || buf[1] === 0xda))
      ) {
        text = zlib.inflateSync(buf).toString('utf8')
      } else if (contentEncoding === 'br') {
        text = zlib.brotliDecompressSync(buf).toString('utf8')
      } else {
        text = buf.toString('utf8')
      }
    } catch (_e) {
      // fallback to raw buffer -> text
      text = buf.toString('utf8')
    }
  } catch (e) {
    throw new Error(`msc.fetchStatus: decoding response failed: ${String(e)}`)
  }

  // The MSC endpoint usually returns JSON. Try parsing it.
  try {
    const parsed = JSON.parse(text)
    return { parsedStatus: parsed }
  } catch (_) {
    // Not JSON; return raw text so caller can store it
    return { raw: text }
  }
}
