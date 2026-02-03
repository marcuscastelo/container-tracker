import Normalized, {
  type Container as NormContainer,
  type Event as NormEvent,
  type Location as NormLocation,
  type Shipment as NormShipment,
} from '../../schemas/containerStatus.schema'
import Msc from '../../schemas/msc.api.schema'
import { parseDate } from './parseDate'

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
        ;(container.locations as Array<Partial<NormLocation> & { events?: NormEvent[] }>).push({
          city: e.Location ?? null,
          events: [ev as NormEvent],
          raw: e,
        })
      }

      ;(shipment.containers as Array<Partial<NormContainer>>).push(container)
    }
  }

  try {
    Normalized.ShipmentSchema.parse(shipment)
  } catch (err) {
    console.warn('Normalized schema parse warning (msc):', err)
  }

  return shipment as NormShipment
}
