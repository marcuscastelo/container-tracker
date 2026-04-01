import { createHash, randomBytes } from 'node:crypto'
import axios from 'axios'
import type { FetchResult } from '~/modules/tracking/infrastructure/carriers/fetchers/fetch-result'
import { parsePilTrackingPayload } from '~/modules/tracking/infrastructure/carriers/normalizers/pil.parser'
import { PilApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/pil.api.schema'
import { systemClock } from '~/shared/time/clock'

function buildNonce(containerNumber: string, timestampMs: number): string {
  const seed = `${containerNumber}|${timestampMs}|${randomBytes(8).toString('hex')}`
  const digest = createHash('md5').update(seed).digest('hex')
  return `${Math.floor(timestampMs / 1000)}|${digest}`
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function toPilParseError(payload: unknown): string | null {
  const schemaResult = PilApiSchema.safeParse(payload)
  if (!schemaResult.success) {
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
  const params = new URLSearchParams({
    module: 'TrackContStatus',
    refNo: containerNumber,
    n: buildNonce(containerNumber, timestampMs),
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
