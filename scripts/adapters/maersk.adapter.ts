import * as Maersk from '../../schemas/api/maersk.api.schema'
import type {
  Container as NormContainer,
  Event as NormEvent,
  Location as NormLocation,
  Shipment as NormShipment,
} from '../../schemas/containerStatus.schema'
import * as Normalized from '../../schemas/containerStatus.schema'
import { parseDate } from './parseDate'

// Adapter: Maersk API -> Normalized ShipmentSchema
export function maerskToNormalized(payload: unknown): NormShipment {
  const parsed = Maersk.MaerskApiSchema.parse(payload)

  const shipment: Partial<NormShipment> = {
    source: { api: 'maersk', fetched_at: new Date(), raw: payload },
    origin: parsed.origin ?? undefined,
    destination: parsed.destination ?? undefined,
    containers: [],
    last_update_time: parsed.last_update_time ? parseDate(parsed.last_update_time) : undefined,
    raw: payload,
  }

  const containers = parsed.containers ?? []
  for (const c of containers) {
    const container: Partial<NormContainer> = {
      container_number: c.container_num ?? 'unknown',
      container_size: c.container_size ?? c.iso_code ?? null,
      container_type: c.container_type ?? null,
      iso_code: c.iso_code ?? null,
      operator: c.operator ?? null,
      locations: [],
      eta_final_delivery: c.eta_final_delivery ? parseDate(c.eta_final_delivery) : null,
      status: c.status ?? null,
      status_code: null,
      last_update_time: c.last_update_time ? parseDate(c.last_update_time) : null,
      raw: c,
    }

    const locs = c.locations ?? []
    for (const loc of locs) {
      const locOut: Partial<NormLocation> & { events: NormEvent[] } = {
        terminal: loc.terminal ?? null,
        city: loc.city ?? null,
        country: loc.country ?? null,
        location_code: loc.location_code ?? null,
        events: [],
        raw: loc,
      }
      const events = loc.events ?? []
      for (const e of events) {
        const ev: Partial<NormEvent> = {
          id: e.eventId ?? null,
          eventType: e.type ?? null,
          activity: e.activity ?? null,
          act_for: e.actfor ?? null,
          is_empty: e.stempty ?? null,
          transport_mode: e.transport_mode ?? null,
          event_time: e.event_time ? parseDate(e.event_time) : null,
          event_time_type: e.event_time_type ?? null,
          vessel: {
            vessel_name: e.vessel_name ?? null,
            voyage_num: e.voyage_num ?? null,
            vessel_num: e.vessel_num ?? null,
          },
          location: {
            city: loc.city ?? null,
            location_code: e.locationCode ?? loc.location_code ?? null,
            raw: loc,
          },
          status_description: null,
          sourceEvent: e,
        }
        locOut.events.push(ev as NormEvent)
      }
      ;(container.locations as Array<Partial<NormLocation> & { events?: NormEvent[] }>).push(locOut)
    }

    ;(shipment.containers as Array<Partial<NormContainer>>).push(container)
  }

  // validate with normalized schema (best-effort)
  try {
    Normalized.ShipmentSchema.parse(shipment)
  } catch (err) {
    console.warn('Normalized schema parse warning (maersk):', err)
  }

  return shipment as NormShipment
}
