import axios from 'axios'
import type { FetchResult } from '~/modules/tracking/infrastructure/carriers/fetchers/fetch-result'
import { parsePilTrackingPayload } from '~/modules/tracking/infrastructure/carriers/normalizers/pil.parser'
import { PilApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/pil.api.schema'
import { systemClock } from '~/shared/time/clock'

type PilNoncePayload = {
  readonly success: boolean
  readonly n: string
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function tryExtractRawText(payload: unknown): string | null {
  if (typeof payload === 'string') return payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null
  }
  if (!('raw_text' in payload)) {
    return null
  }

  const rawText = payload.raw_text
  return typeof rawText === 'string' ? rawText : null
}

function tryExtractRejectedSupportId(rawText: string): string | null {
  const supportIdMatch = rawText.match(/support ID is\s+([^<\n\r]+)/iu)
  const supportId = supportIdMatch?.[1]?.trim() ?? null
  return supportId && supportId.length > 0 ? supportId : null
}

function isPilNoncePayload(value: unknown): value is PilNoncePayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  if (!('success' in value) || !('n' in value)) {
    return false
  }

  return typeof value.success === 'boolean' && typeof value.n === 'string'
}

async function fetchPilNonce(
  timestampMs: number,
  containerNumber: string,
): Promise<{
  readonly nonce: string | null
  readonly payload: unknown
  readonly parseError: string | null
}> {
  const response = await axios.get(
    `https://www.pilship.com/wp-content/themes/hello-theme-child-master/pil-api/common/get-n.php?timestamp=${timestampMs}`,
    {
      responseType: 'text',
      decompress: true,
      timeout: 30_000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://www.pilship.com/digital-solutions/?tab=customer&id=track-trace&label=containerTandT&module=TrackContStatus&refNo=${encodeURIComponent(containerNumber)}`,
      },
    },
  )

  const rawText = typeof response.data === 'string' ? response.data : String(response.data)
  const payload = tryParseJson(rawText) ?? { raw_text: rawText }

  if (!isPilNoncePayload(payload)) {
    return {
      nonce: null,
      payload,
      parseError: 'PIL nonce response missing expected success/n shape',
    }
  }

  if (payload.success === false || payload.n.trim().length === 0) {
    return {
      nonce: null,
      payload,
      parseError: 'PIL nonce request returned an unsuccessful response',
    }
  }

  return {
    nonce: payload.n,
    payload,
    parseError: null,
  }
}

function toPilParseError(payload: unknown): string | null {
  const schemaResult = PilApiSchema.safeParse(payload)
  if (!schemaResult.success) {
    const rawText = tryExtractRawText(payload)
    if (rawText !== null && /<title>\s*Request Rejected\s*<\/title>/iu.test(rawText)) {
      const supportId = tryExtractRejectedSupportId(rawText)
      if (supportId !== null) {
        return `PIL request rejected by carrier firewall/WAF (support ID: ${supportId})`
      }
      return 'PIL request rejected by carrier firewall/WAF'
    }

    return 'PIL response missing expected success/data shape'
  }

  if (schemaResult.data.success === false) {
    return 'PIL returned an unsuccessful tracking response'
  }

  const trackingParse = parsePilTrackingPayload(schemaResult.data)
  if (!trackingParse.ok) {
    return trackingParse.error
  }

  return null
}

export async function fetchPilStatus(containerNumber: string): Promise<FetchResult> {
  const timestampMs = Date.now()
  const nonceResult = await fetchPilNonce(timestampMs, containerNumber)
  if (nonceResult.parseError !== null || nonceResult.nonce === null) {
    return {
      provider: 'pil',
      payload: {
        nonce_response: nonceResult.payload,
      },
      fetchedAt: systemClock.now().toIsoString(),
      parseError: nonceResult.parseError,
    }
  }

  const params = new URLSearchParams({
    module: 'TrackContStatus',
    refNo: containerNumber,
    n: nonceResult.nonce,
    timestamp: String(timestampMs),
  })

  const response = await axios.get(
    `https://www.pilship.com/wp-content/themes/hello-theme-child-master/pil-api/trackntrace-containertnt.php?${params.toString()}`,
    {
      responseType: 'text',
      decompress: true,
      timeout: 30_000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://www.pilship.com/digital-solutions/?tab=customer&id=track-trace&label=containerTandT&module=TrackContStatus&refNo=${encodeURIComponent(containerNumber)}`,
        Connection: 'keep-alive',
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
    },
  )

  const rawText = typeof response.data === 'string' ? response.data : String(response.data)
  const payload = tryParseJson(rawText) ?? { raw_text: rawText }
  let parseError = toPilParseError(payload)

  if (response.status < 200 || response.status >= 300) {
    const statusError = `PIL request failed with status ${response.status}`
    parseError = parseError === null ? statusError : `${statusError}: ${parseError}`
  }

  return {
    provider: 'pil',
    payload,
    fetchedAt: systemClock.now().toIsoString(),
    parseError,
  }
}
