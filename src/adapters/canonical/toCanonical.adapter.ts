import { type F1Shipment, F1ShipmentSchema } from '~/schemas/canonical/canonical.schema'

function upperTrim(v: unknown): string {
  if (!v && v !== 0) return ''
  return String(v).trim().toUpperCase()
}

// Basic ISO 6346 validation (4 letters + 7 digits)
const isIso6346 = (s: string) => /^[A-Z]{4}\d{7}$/.test(s)

export function mapParsedStatusToF1(
  parsed: unknown,
  containerId: string,
  provider: string,
): { ok: true; shipment: F1Shipment } | { ok: false; error: string } {
  try {
    const now = new Date()
    const normalizedContainerNumber = upperTrim(containerId)
    if (!isIso6346(normalizedContainerNumber)) {
      return { ok: false, error: `container number '${containerId}' failed ISO 6346 validation` }
    }

    // Attempt to read common fields from parsed payload
    const p = parsed as Record<string, unknown>
    const shipmentId = String(p?.process_id ?? p?.process ?? `ship-${normalizedContainerNumber}`)

    const origin = p?.origin ?? p?.origin_display ?? undefined
    const destination = p?.destination ?? p?.destination_display ?? undefined

    // Find container info if present
    let c: Record<string, unknown> | null = null
    const containersRaw = p?.containers as unknown
    if (Array.isArray(containersRaw) && (containersRaw as unknown[]).length > 0) {
      const arr = containersRaw as unknown[]
      c =
        (arr.find((ci) => {
          const ciObj = ci as Record<string, unknown>
          const num = upperTrim(
            ciObj?.container_number ?? ciObj?.container_no ?? ciObj?.ContainerNumber ?? '',
          )
          return num === normalizedContainerNumber
        }) as Record<string, unknown> | undefined) ?? (arr[0] as Record<string, unknown>)
    }
    // fallback to top-level fields
    if (!c) c = p

    const etaRaw = c?.eta_final_delivery ?? c?.eta ?? p?.eta ?? p?.EstimatedTimeOfArrival ?? null
    let eta: Date | null = null
    if (etaRaw) {
      // Accept strings, numbers or Date instances — guard against object literals
      if (typeof etaRaw === 'string' || typeof etaRaw === 'number' || etaRaw instanceof Date) {
        const d = new Date(etaRaw as string | number | Date)
        if (!Number.isNaN(d.getTime())) eta = d
      }
    }

    const statusRaw = c?.status ?? p?.current_status ?? p?.status ?? null
    // Normalize status into canonical ContainerStatusEnum when possible
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
      // common synonyms
      if (raw === 'AVAILABLE') return 'AVAILABLE_FOR_PICKUP'
      if (raw === 'LOADED') return 'LOADED_ON_VESSEL'
      if (raw === 'GATEIN' || raw === 'GATE-IN') return 'GATE_IN'
      if (raw === 'GATEOUT' || raw === 'GATE-OUT') return 'UNKNOWN'
      return null
    }
    const status = mapStatusToCanonical(statusRaw)

    // events may be present in multiple shapes: top-level c.events or nested inside
    // container.locations[].events (common for CMA-CGM normalized output). Try several
    // fallbacks to extract an array of event objects.
    const eventsRaw = c?.events ?? c?.Events ?? p?.events ?? p?.Events ?? null
    let events: unknown[] | undefined = undefined
    if (Array.isArray(eventsRaw)) {
      events = eventsRaw as unknown[]
    } else if (Array.isArray(c?.locations)) {
      // flatten location.events arrays into events
      const locs = c.locations
      const flat: unknown[] = []
      for (const L of locs) {
        if (!L) continue
        if (Array.isArray(L.events)) {
          for (const ev of L.events) flat.push(ev)
        }
        // also accept other conventions
        if (Array.isArray(L.Events)) {
          for (const ev of L.Events) flat.push(ev)
        }
      }
      if (flat.length > 0) events = flat
    }

    const eventsMapped = Array.isArray(events)
      ? (events as unknown[]).map((ev) => {
          const evObj = ev as Record<string, unknown>
          const rawEventTime = evObj?.event_time ?? evObj?.Date ?? evObj?.DateString ?? undefined
          const eventTimeTypeRaw = evObj?.event_time_type ?? evObj?.EventTimeType ?? undefined
          const eventTimeType =
            typeof eventTimeTypeRaw === 'string'
              ? String(eventTimeTypeRaw).toUpperCase()
              : undefined

          const rawActivity = String(
            evObj?.activity ?? evObj?.Activity ?? evObj?.StatusDescription ?? 'OTHER',
          ).toUpperCase()
          // Map various free-text activities into canonical EventActivity values where possible
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
            event_time: rawEventTime as unknown,
            event_time_type: evtTimeType as unknown,
            location: evObj?.location ?? evObj?.Location ?? undefined,
            sourceEvent: evObj,
          }
        })
      : undefined

    const container = {
      id: `${shipmentId}-${normalizedContainerNumber}`,
      container_number: normalizedContainerNumber,
      shipment_id: shipmentId,
      status: status ?? null,
      initial_status: status ? undefined : 'UNKNOWN',
      eta: eta ?? undefined,
      flags: { missing_eta: !eta, stale_data: false },
      events: eventsMapped,
      source: { type: 'api' as const, api: provider, fetched_at: now, raw: parsed },
      created_at: now,
      raw: c ?? parsed,
    }

    const shipment = {
      id: shipmentId,
      origin: typeof origin === 'object' ? origin : origin ? { city: String(origin) } : undefined,
      destination:
        typeof destination === 'object'
          ? destination
          : destination
            ? { city: String(destination) }
            : undefined,
      // p is a loose object; safely read nested source.api if present
      carrier:
        (typeof p?.source === 'object' && p?.source !== null
          ? ((p.source as Record<string, unknown>)['api'] as string | undefined)
          : undefined) ??
        provider ??
        null,
      created_at: now,
      source: { type: 'api' as const, api: provider, fetched_at: now, raw: parsed },
      containers: [container],
      raw: parsed,
    }

    // validate via zod
    const parsedShipment = F1ShipmentSchema.safeParse(shipment)
    if (!parsedShipment.success) {
      console.warn('toCanonical: canonical validation failed', parsedShipment.error.format())
      return {
        ok: false,
        error: `canonical validation failed: ${JSON.stringify(parsedShipment.error.format())}`,
      }
    }

    return { ok: true, shipment: parsedShipment.data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
