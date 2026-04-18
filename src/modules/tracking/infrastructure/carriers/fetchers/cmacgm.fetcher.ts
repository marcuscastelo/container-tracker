import axios from 'axios'
import type { FetchResult } from '~/modules/tracking/infrastructure/carriers/fetchers/fetch-result'
import { systemClock } from '~/shared/time/clock'

function normalizeLogText(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, maxLength)}...`
}

function isParseFailurePayload(payload: unknown): payload is {
  readonly parse_failure: true
  readonly raw_html_snippet: string
  readonly reason: 'response_data_not_found' | 'invalid_response_data_json'
} {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false
  }
  if (!('parse_failure' in payload)) {
    return false
  }
  return payload.parse_failure === true
}

function toCmaCgmHtmlParseError(payload: unknown): string | null {
  if (isParseFailurePayload(payload)) {
    if (payload.reason === 'response_data_not_found') {
      return 'CMA-CGM response HTML missing expected options.responseData payload'
    }
    return 'CMA-CGM response HTML contained invalid options.responseData JSON'
  }
  return null
}

/**
 * Fetch tracking data from CMA-CGM's public tracking endpoint.
 *
 * CMA-CGM returns HTML with embedded JSON in `options.responseData`.
 * We extract and parse that JSON payload.
 */
export async function fetchCmaCgmStatus(containerNumber: string): Promise<FetchResult> {
  const url = 'https://www.cma-cgm.com/ebusiness/tracking/search'
  const startedAtMs = Date.now()
  console.log('[tracking:cmacgm] request', {
    method: 'POST',
    url,
    containerNumber,
  })

  const response = await axios
    .post(
      url,
      new URLSearchParams({
        __RequestVerificationToken:
          'WSKXu5mATqHpEopOTqNHnfZdedqy3gil1IV1XMncr66exbjY5Ks6KO4ekvCROhP42Lkh9F3zegXkzFIPlO2aRnDgxFaIQU61qzAI_9dNZtc1',
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
          Cookie:
            'datadome=F4C3piYK84t_34olK3LkOba3h0iWGmhXKlZa51JSvQmBWRd5iyiy2~zZkfLDt3bsQEv5RQQqkzXiZ65kQRDQ0UX8aSfy4dYURaY~HTFsNcHROHWDkSZMnjmW8D6VEPYk; __RequestVerificationToken=64dS2BI8rYboYSq-JMaZn8dlXYijOkaLdFJIT0yXutdjqNzUCLbsLr61l1KUejvvPx1wCOqIFdpoh3vDBPBgt1B2j80asuEgtNeRpz0H2lI1; dtCookie=v_4_srv_2_sn_786CC8D9A19CFA6CC105F857BA5985D7_perc_100000_ol_0_mul_1_app-3A0b422508580a7b79_0_rcs-3Acss_0; Human_Search=1; MustRelease=22.0.4.0',
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
    .catch((error: unknown) => {
      if (axios.isAxiosError(error)) {
        console.error('[tracking:cmacgm] response error', {
          method: 'POST',
          url,
          containerNumber,
          status: error.response?.status ?? null,
          message: error.message,
          durationMs: Date.now() - startedAtMs,
        })
      }
      throw error
    })

  const html: string = response.data
  console.log('[tracking:cmacgm] response', {
    method: 'POST',
    url,
    containerNumber,
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    durationMs: Date.now() - startedAtMs,
    htmlPreview: normalizeLogText(html),
  })

  const payload = extractResponseData(html)
  const parseError = toCmaCgmHtmlParseError(payload)
  if (parseError !== null) {
    console.warn('[tracking:cmacgm] parse failed', {
      method: 'POST',
      url,
      containerNumber,
      error: normalizeLogText(parseError),
      htmlSnippet: isParseFailurePayload(payload)
        ? normalizeLogText(payload.raw_html_snippet)
        : null,
    })
  } else {
    console.log('[tracking:cmacgm] parse success', {
      method: 'POST',
      url,
      containerNumber,
    })
  }

  return {
    provider: 'cmacgm',
    payload,
    fetchedAt: systemClock.now().toIsoString(),
    parseError,
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
    return {
      parse_failure: true,
      reason: 'response_data_not_found',
      raw_html_snippet: html.slice(0, 2000),
    }
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
    return {
      parse_failure: true,
      reason: 'invalid_response_data_json',
      raw_html_snippet: html.slice(0, 2000),
    }
  }
}
