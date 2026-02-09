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

  const shipment: NormShipment = {
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
      const container: NormContainer = {
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
        service_type_origin: undefined,
        service_type_destination: undefined,
        raw: info,
      }

      const events = info.Events ?? []
      for (const e of events) {
        const ev: NormEvent = {
          id: null,
          eventType: 'MSC_EVENT',
          activity: e.Description ?? null,
          event_time: e.Date ? parseDate(e.Date) : null,
          event_time_type: undefined,
          vessel: {
            vessel_name: e.Detail?.[0] ?? null,
            voyage_num: e.Detail?.[1] ?? null,
            vessel_num: null,
            imo: undefined,
            built: undefined,
            flag: undefined,
            flagName: undefined,
            raw: undefined,
          },
          location: {
            terminal: null,
            geo_site: undefined,
            city: e.Location ?? null,
            state: undefined,
            country: null,
            country_code: undefined,
            geoid_city: undefined,
            site_type: undefined,
            location_code: e.UnLocationCode ?? null,
            raw: e,
          },
          status_code: null,
          status_description: e.Description ?? null,
          detail: null,
          order: null,
          sourceEvent: e,
        }
        const locs: NormLocation[] = Array.isArray(container.locations) ? container.locations : []
        const newLoc: NormLocation & { events?: NormEvent[] } = {
          terminal: null,
          geo_site: undefined,
          city: e.Location ?? null,
          state: undefined,
          country: null,
          country_code: undefined,
          geoid_city: undefined,
          site_type: undefined,
          location_code: e.UnLocationCode ?? null,
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
