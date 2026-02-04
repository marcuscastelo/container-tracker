import { F1ContainerSchema, type F1Shipment, F1ShipmentSchema } from '~/schemas/canonical.schema'

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
    const p = parsed as any
    const shipmentId = String(p?.process_id ?? p?.process ?? `ship-${normalizedContainerNumber}`)

    const origin = p?.origin ?? p?.origin_display ?? undefined
    const destination = p?.destination ?? p?.destination_display ?? undefined

    // Find container info if present
    let c: any = null
    if (Array.isArray(p?.containers) && p.containers.length > 0) {
      c =
        p.containers.find((ci: any) => {
          const num = upperTrim(
            ci?.container_number ?? ci?.container_no ?? ci?.ContainerNumber ?? '',
          )
          return num === normalizedContainerNumber
        }) ?? p.containers[0]
    }
    // fallback to top-level fields
    if (!c) c = p

    const etaRaw = c?.eta_final_delivery ?? c?.eta ?? p?.eta ?? p?.EstimatedTimeOfArrival ?? null
    let eta: Date | null = null
    if (etaRaw) {
      const d = new Date(etaRaw)
      if (!Number.isNaN(d.getTime())) eta = d
    }

    const status = c?.status ?? p?.current_status ?? p?.status ?? null

    const eventsRaw = c?.events ?? c?.Events ?? p?.events ?? p?.Events ?? null
    const events = Array.isArray(eventsRaw)
      ? eventsRaw.map((ev: any) => ({
          id: String(ev?.id ?? ev?.Id ?? ev?.EventId ?? '') || undefined,
          activity: (ev?.activity ?? ev?.Activity ?? 'OTHER').toUpperCase(),
          event_time: ev?.event_time ?? ev?.Date ?? ev?.DateString ?? undefined,
          event_time_type: (ev?.event_time_type ?? ev?.EventTimeType ?? undefined) as any,
          location: ev?.location ?? ev?.Location ?? undefined,
          sourceEvent: ev,
        }))
      : undefined

    const container = {
      id: `${shipmentId}-${normalizedContainerNumber}`,
      container_number: normalizedContainerNumber,
      shipment_id: shipmentId,
      status: status ?? null,
      initial_status: status ? undefined : 'UNKNOWN',
      eta: eta ?? undefined,
      flags: { missing_eta: !eta, stale_data: false },
      events,
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
      carrier: p?.source?.api ?? provider ?? null,
      created_at: now,
      source: { type: 'api' as const, api: provider, fetched_at: now, raw: parsed },
      containers: [container],
      raw: parsed,
    }

    // validate via zod
    const parsedShipment = F1ShipmentSchema.safeParse(shipment)
    if (!parsedShipment.success) {
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
