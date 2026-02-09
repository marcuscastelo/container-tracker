import z from 'zod'
import {
  type F1Shipment,
  F1ShipmentSchema,
} from '~/modules/container/domain/schemas/canonical.schema'
import { safeParseOrDefault } from '~/shared/utils/safeParseOrDefault'

function upperTrim(v: unknown): string {
  if (!v && v !== 0) return ''
  return String(v).trim().toUpperCase()
}

// Basic ISO 6346 validation (4 letters + 7 digits)
const isIso6346 = (s: string) => /^[A-Z]{4}\d{7}$/.test(s)

export function mapParsedStatusToF1(
  rawEvents: Record<string, unknown>,
  containerId: string,
  provider: string,
): { ok: true; shipment: F1Shipment } | { ok: false; error: string } {
  try {
    const now = new Date()
    const normalizedContainerNumber = upperTrim(containerId)
    if (!isIso6346(normalizedContainerNumber)) {
      return { ok: false, error: `container number '${containerId}' failed ISO 6346 validation` }
    }

    const parsedPayload = parsePayload(rawEvents)
    const shipmentId = getShipmentId(parsedPayload, normalizedContainerNumber)
    const origin = getOrigin(parsedPayload)
    const destination = getDestination(parsedPayload)

    const containerInfo = findContainerInfo(parsedPayload, normalizedContainerNumber)
    const eta = extractEta(containerInfo, parsedPayload)

    const status = mapStatusToCanonical(
      containerInfo?.status ?? parsedPayload?.current_status ?? parsedPayload?.status ?? null,
    )
    const events = extractEvents(containerInfo, parsedPayload)
    console.debug(
      `toCanonical: mapped container '${containerId}' to shipment '${shipmentId}' with status '${status}' and eta '${eta}'`,
    )

    const container = buildContainer({
      shipmentId,
      normalizedContainerNumber,
      status,
      eta,
      events,
      provider,
      now,
      rawEvents,
      containerInfo,
    })
    console.debug(
      `toCanonical: built container for shipment '${shipmentId}' with container number '${normalizedContainerNumber}'`,
    )

    const shipment = buildShipment({
      shipmentId,
      origin,
      destination,
      provider,
      now,
      rawEvents,
      parsedPayload,
      container,
    })
    console.debug(
      `toCanonical: built shipment '${shipmentId}' with origin '${origin}' and destination '${destination}'`,
    )

    // validate via zod
    const parsedShipment = F1ShipmentSchema.safeParse(shipment)
    if (!parsedShipment.success) {
      console.warn('toCanonical: canonical validation failed', parsedShipment.error.format())
      return {
        ok: false,
        error: `canonical validation failed: ${JSON.stringify(parsedShipment.error.format())}`,
      }
    }
    console.debug(`toCanonical: successfully mapped to canonical shipment '${shipmentId}'`)

    return { ok: true, shipment: parsedShipment.data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

function parsePayload(rawEvents: Record<string, unknown>): Record<string, unknown> {
  return safeParseOrDefault(rawEvents, z.record(z.string(), z.unknown()), {})
}

function getShipmentId(
  parsedPayload: Record<string, unknown>,
  normalizedContainerNumber: string,
): string {
  return String(
    parsedPayload?.process_id ?? parsedPayload?.process ?? `ship-${normalizedContainerNumber}`,
  )
}

function getOrigin(
  parsedPayload: Record<string, unknown>,
): Record<string, unknown> | string | undefined {
  const raw = parsedPayload?.origin ?? parsedPayload?.origin_display
  if (raw == null) return undefined
  if (typeof raw === 'string') return raw
  const parsed = safeParseOrDefault(raw, z.record(z.string(), z.unknown()), null)
  return parsed ?? undefined
}

function getDestination(
  parsedPayload: Record<string, unknown>,
): Record<string, unknown> | string | undefined {
  const raw = parsedPayload?.destination ?? parsedPayload?.destination_display
  if (raw == null) return undefined
  if (typeof raw === 'string') return raw
  const parsed = safeParseOrDefault(raw, z.record(z.string(), z.unknown()), null)
  return parsed ?? undefined
}

function findContainerInfo(
  parsedPayload: Record<string, unknown>,
  normalizedContainerNumber: string,
): Record<string, unknown> | null {
  const containersRaw = parsedPayload?.containers
  if (Array.isArray(containersRaw) && containersRaw.length > 0) {
    const arr = containersRaw
    const found =
      (arr.find((ci) => {
        const ciRec = safeParseOrDefault(ci, z.record(z.string(), z.unknown()), null)
        if (!ciRec) return false
        const num = upperTrim(
          ciRec?.container_number ?? ciRec?.container_no ?? ciRec?.ContainerNumber ?? '',
        )
        return num === normalizedContainerNumber
      }) satisfies Record<string, unknown> | undefined) ??
      safeParseOrDefault(arr[0], z.record(z.string(), z.unknown()), null)
    if (found) return found
  }
  // fallback to top-level fields
  return parsedPayload
}

function extractEta(
  containerInfo: Record<string, unknown> | null,
  parsedPayload: Record<string, unknown>,
): Date | null {
  const etaRaw =
    containerInfo?.eta_final_delivery ??
    containerInfo?.eta ??
    parsedPayload?.eta ??
    parsedPayload?.EstimatedTimeOfArrival ??
    null
  if (etaRaw) {
    if (typeof etaRaw === 'string' || typeof etaRaw === 'number' || etaRaw instanceof Date) {
      let d: Date
      if (typeof etaRaw === 'number') d = new Date(etaRaw)
      else d = new Date(String(etaRaw))
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return null
}

const canonicalStatuses = new Set([
  'UNKNOWN',
  'AWAITING_DATA',
  'GATE_IN',
  'LOADED_ON_VESSEL',
  'DEPARTED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'CUSTOMS_HOLD',
  'CUSTOMS_RELEASED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
  'CANCELLED',
])

function mapStatusToCanonical(s: unknown): string | null {
  if (!s && s !== 0) return null
  const raw = String(s).toUpperCase().replace(/\s+/g, '_')
  if (canonicalStatuses.has(raw)) return raw
  if (raw === 'AVAILABLE') return 'AVAILABLE_FOR_PICKUP'
  if (raw === 'LOADED') return 'LOADED_ON_VESSEL'
  if (raw === 'GATEIN' || raw === 'GATE-IN') return 'GATE_IN'
  if (raw === 'GATEOUT' || raw === 'GATE-OUT') return 'UNKNOWN'
  return null
}

function extractEvents(
  containerInfo: Record<string, unknown> | null,
  parsedPayload: Record<string, unknown>,
): Record<string, unknown>[] | undefined {
  const eventsRaw =
    containerInfo?.events ??
    containerInfo?.Events ??
    parsedPayload?.events ??
    parsedPayload?.Events ??
    null
  if (Array.isArray(eventsRaw)) {
    return eventsRaw.map(mapEvent)
  } else if (Array.isArray(containerInfo?.locations)) {
    const locs = containerInfo.locations
    const flat: Record<string, unknown>[] = []
    for (const L of locs) {
      if (!L) continue
      if (Array.isArray(L.events)) {
        for (const ev of L.events) flat.push(mapEvent(ev))
      }
      if (Array.isArray(L.Events)) {
        for (const ev of L.Events) flat.push(mapEvent(ev))
      }
    }
    if (flat.length > 0) return flat
  }
  return undefined
}

function mapEvent(ev: unknown): Record<string, unknown> {
  const evObj: Record<string, unknown> = safeParseOrDefault(
    ev,
    z.record(z.string(), z.unknown()),
    {},
  )
  const rawEventTime = evObj?.event_time ?? evObj?.Date ?? evObj?.DateString ?? undefined
  const eventTimeTypeRaw = evObj?.event_time_type ?? evObj?.EventTimeType ?? undefined
  const eventTimeType =
    typeof eventTimeTypeRaw === 'string' ? String(eventTimeTypeRaw).toUpperCase() : undefined

  const rawActivity = String(
    evObj?.activity ?? evObj?.Activity ?? evObj?.StatusDescription ?? 'OTHER',
  ).toUpperCase()
  let activityMapped: string = 'OTHER'
  if (/DEPART/.test(rawActivity)) activityMapped = 'DEPARTURE'
  else if (/ARRIV|ARRIVED/.test(rawActivity)) activityMapped = 'ARRIVAL'
  else if (/LOAD|LOADED/.test(rawActivity)) activityMapped = 'LOAD'
  else if (/DISCHARG|DISCHARGED/.test(rawActivity)) activityMapped = 'DISCHARGE'
  else if (/GATE_IN|GATEIN/.test(rawActivity)) activityMapped = 'GATE_IN'
  else if (/GATE_OUT|GATEOUT/.test(rawActivity)) activityMapped = 'GATE_OUT'
  else if (/CUSTOMS/.test(rawActivity)) activityMapped = 'CUSTOMS_HOLD'

  const idRaw = evObj?.id ?? evObj?.Id ?? evObj?.EventId ?? undefined
  const idStr = idRaw == null ? undefined : String(idRaw)
  const evtTimeType = typeof eventTimeType === 'string' ? eventTimeType : undefined

  return {
    id: idStr,
    activity: activityMapped,
    event_time: rawEventTime,
    event_time_type: evtTimeType,
    location: evObj?.location ?? evObj?.Location ?? undefined,
    sourceEvent: evObj,
  }
}

const BuildContainerSchema = z.object({
  shipmentId: z.string(),
  normalizedContainerNumber: z.string(),
  status: z.string().nullable(),
  eta: z.date().nullable(),
  events: z.array(z.record(z.string(), z.unknown())).optional(),
  provider: z.string(),
  now: z.date(),
  rawEvents: z.record(z.string(), z.unknown()),
  containerInfo: z.record(z.string(), z.unknown()).nullable(),
})
type BuildContainerParams = z.infer<typeof BuildContainerSchema>

function buildContainer(params: BuildContainerParams) {
  return {
    id: `${params.shipmentId}-${params.normalizedContainerNumber}`,
    container_number: params.normalizedContainerNumber,
    shipment_id: params.shipmentId,
    status: params.status ?? null,
    eta: params.eta ?? undefined,
    flags: { missing_eta: !params.eta, stale_data: false },
    events: params.events,
    source: {
      type: 'api' as const,
      api: params.provider,
      fetched_at: params.now,
      raw: params.rawEvents,
    },
    created_at: params.now,
    raw: params.containerInfo ?? params.rawEvents,
  }
}

const BuildShipmentSchema = z.object({
  shipmentId: z.string(),
  origin: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  destination: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  provider: z.string(),
  now: z.date(),
  rawEvents: z.record(z.string(), z.unknown()),
  parsedPayload: z.record(z.string(), z.unknown()),
  container: z.object({
    id: z.string(),
    container_number: z.string(),
    shipment_id: z.string(),
    status: z.string().nullable(),
    eta: z.date().optional(),
    flags: z.object({
      missing_eta: z.boolean(),
      stale_data: z.boolean(),
    }),
    events: z.array(z.record(z.string(), z.unknown())).optional(),
    source: z.object({
      type: z.literal('api'),
      api: z.string(),
      fetched_at: z.date(),
      raw: z.record(z.string(), z.unknown()),
    }),
    created_at: z.date(),
    raw: z.record(z.string(), z.unknown()),
  }),
})
type BuildShipmentParams = z.infer<typeof BuildShipmentSchema>

function buildShipment(params: BuildShipmentParams) {
  return {
    id: params.shipmentId,
    origin:
      typeof params.origin === 'object'
        ? params.origin
        : params.origin
          ? { city: String(params.origin) }
          : undefined,
    destination:
      typeof params.destination === 'object'
        ? params.destination
        : params.destination
          ? { city: String(params.destination) }
          : undefined,
    carrier: (() => {
      const src = params.parsedPayload?.source
      const srcRec = safeParseOrDefault(src, z.record(z.string(), z.unknown()), null)
      if (srcRec) {
        const apiVal = srcRec['api']
        if (typeof apiVal === 'string') return apiVal
      }
      return params.provider ?? null
    })(),
    created_at: params.now,
    source: {
      type: 'api' as const,
      api: params.provider,
      fetched_at: params.now,
      raw: params.rawEvents,
    },
    containers: [params.container],
    raw: params.rawEvents,
  }
}
