import type {
  Container as NormContainer,
  Event as NormEvent,
  Location as NormLocation,
  Shipment as NormShipment,
} from '~/modules/container/domain/schemas/containerStatus.schema'
import * as Normalized from '~/modules/container/domain/schemas/containerStatus.schema'
import * as Msc from '~/modules/container/infrastructure/schemas/api/msc.api.schema'
import { parseDate } from '~/shared/utils/parseDate'

export function mscToNormalized(payload: unknown): NormShipment {
  const parsed = Msc.MscApiSchema.parse(payload)

  const shipment: Partial<NormShipment> = {
    source: { api: 'msc', fetched_at: new Date(), raw: payload },
    origin: undefined,
    destination: undefined,
    containers: [],
    last_update_time: null,
    raw: payload,
  }

  const bills = parsed.Data?.BillOfLadings ?? []
  for (const b of bills) {
    const infos = b.ContainersInfo ?? []
    for (const info of infos) {
      const container: Partial<NormContainer> = {
        container_number: info.ContainerNumber ?? parsed.Data?.TrackingNumber ?? 'unknown',
        container_size: null,
        container_type: info.ContainerType ?? null,
        iso_code: null,
        operator: null,
        locations: [],
        eta_final_delivery: info.PodEtaDate ? parseDate(info.PodEtaDate) : null,
        status: null,
        status_code: null,
        last_update_time: null,
        raw: info,
      }

      const events = info.Events ?? []
      for (const e of events) {
        const ev: Partial<NormEvent> = {
          id: null,
          eventType: 'MSC_EVENT',
          activity: e.Description ?? null,
          event_time: e.Date ? parseDate(e.Date) : null,
          vessel: { vessel_name: e.Detail?.[0] ?? null, voyage_num: e.Detail?.[1] ?? null },
          location: { city: e.Location ?? null, location_code: e.UnLocationCode ?? null, raw: e },
          status_description: e.Description ?? null,
          sourceEvent: e,
        }
        // ensure container.locations is an array and append
        let locs: unknown[] = []
        if (Array.isArray(container.locations)) locs = container.locations
        const newLoc = {
          city: e.Location ?? null,
          events: [ev],
          raw: e,
        }
        locs.push(newLoc)
        container.locations = locs
      }

      if (!Array.isArray(shipment.containers)) shipment.containers = []
      shipment.containers.push(container)
    }
  }

  try {
    // validate and return normalized shipment when possible
    return Normalized.ShipmentSchema.parse(shipment)
  } catch (err) {
    console.warn('Normalized schema parse warning (msc):', err)
  }

  return shipment
}
