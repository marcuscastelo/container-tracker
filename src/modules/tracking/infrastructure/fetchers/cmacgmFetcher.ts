import axios from 'axios'
import type { Provider } from '~/modules/tracking/domain/provider'
import type { FetchResult } from '~/modules/tracking/infrastructure/fetchers/mscFetcher'

/**
 * Fetch tracking data from CMA-CGM's public tracking endpoint.
 *
 * CMA-CGM returns HTML with embedded JSON in `options.responseData`.
 * We extract and parse that JSON payload.
 */
export async function fetchCmaCgmStatus(containerNumber: string): Promise<FetchResult> {
  const response = await axios.post(
    'https://www.cma-cgm.com/ebusiness/tracking/search',
    new URLSearchParams({
      __RequestVerificationToken:
        'LXDaegidzJ7-SGQfrRDUDGSyU7iz97NftbpPpk1gW7EniJHdlbPcnJjCn4ZguciOiXDTcCixp-t9U-ASsTrXVNCcvz4uyhtCmqqH3o0XkyE1',
      'SearchViewModel.SearchBy': 'Container',
      'SearchViewModel.Reference': containerNumber,
      'SearchViewModel.FromHome': 'true',
      search: '',
    }),
    {
      responseType: 'text',
      decompress: true,
      timeout: 30_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Referer: 'https://www.cma-cgm.com/ebusiness/tracking/search',
        Origin: 'https://www.cma-cgm.com',
        'Sec-GPC': '1',
        'Alt-Used': 'www.cma-cgm.com',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        Priority: 'u=0, i',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        TE: 'trailers',
      },
    },
  )

  const html: string = response.data
  const payload = extractResponseData(html)

  return {
    provider: 'cmacgm',
    payload,
    fetchedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractResponseData(html: string): unknown {
  const regex = /options\.responseData\s*=\s*(['"])([\s\S]*?)\1/
  const match = html.match(regex)

  if (!match?.[2]) {
    // No embedded JSON found — store the raw HTML snippet for debugging
    return { parse_failure: true, raw_html_snippet: html.slice(0, 2000) }
  }

  const inner = match[2]
    .replace(/\\\//g, '/')
    .replace(/\\n/g, '')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')

  try {
    return JSON.parse(inner)
  } catch {
    return { parse_failure: true, raw_html_snippet: html.slice(0, 2000) }
  }
}
