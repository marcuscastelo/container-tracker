import type { NavbarAlertsSummaryData } from '~/shared/api/navbar-alerts/navbar-alerts.contract'
import { typedFetch } from '~/shared/api/typedFetch'
import {
  type NavbarAlertsSummaryResponse,
  NavbarAlertsSummaryResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'
import { systemClock } from '~/shared/time/clock'

const NAVBAR_ALERTS_SUMMARY_ENDPOINT = '/api/operational-incidents/navbar-summary'
const NAVBAR_ALERTS_CACHE_TTL_MS = 15_000

type NavbarAlertsCacheRecord = {
  readonly expiresAtMs: number
  readonly value: NavbarAlertsSummaryResponse
}

let navbarAlertsCache: NavbarAlertsCacheRecord | null = null
let inFlightNavbarAlerts: Promise<NavbarAlertsSummaryResponse> | null = null

function nowMs(): number {
  return systemClock.now().toEpochMs()
}

function readFreshNavbarAlertsCache(): NavbarAlertsSummaryResponse | null {
  if (!navbarAlertsCache) return null
  if (navbarAlertsCache.expiresAtMs <= nowMs()) {
    navbarAlertsCache = null
    return null
  }
  return navbarAlertsCache.value
}

function writeNavbarAlertsCache(value: NavbarAlertsSummaryResponse): void {
  navbarAlertsCache = {
    value,
    expiresAtMs: nowMs() + NAVBAR_ALERTS_CACHE_TTL_MS,
  }
}

export async function fetchNavbarAlertsSummary(options?: {
  readonly preferCached?: boolean
}): Promise<NavbarAlertsSummaryData> {
  if (options?.preferCached === true) {
    const cached = readFreshNavbarAlertsCache()
    if (cached !== null) return cached
  }

  if (inFlightNavbarAlerts) return inFlightNavbarAlerts

  const request = typedFetch(
    NAVBAR_ALERTS_SUMMARY_ENDPOINT,
    undefined,
    NavbarAlertsSummaryResponseSchema,
  )
    .then((value) => {
      writeNavbarAlertsCache(value)
      return value
    })
    .finally(() => {
      inFlightNavbarAlerts = null
    })

  inFlightNavbarAlerts = request
  return request
}

export function clearNavbarAlertsSummaryCache(): void {
  navbarAlertsCache = null
  inFlightNavbarAlerts = null
}
