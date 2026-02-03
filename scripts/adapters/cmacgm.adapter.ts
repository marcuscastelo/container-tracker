import Cma, { type CmaCgmApi, CmaCgmApiSchema } from '../../schemas/cmacgm.api.schema'
import Normalized, {
  type Container as NormContainer,
  type Event as NormEvent,
  type Location as NormLocation,
  type Shipment as NormShipment,
} from '../../schemas/containerStatus.schema'
import { parseDate } from './parseDate'

type Move = NonNullable<CmaCgmApi['CurrentMoves']>[number]

export function cmacgmToNormalized(payload: unknown): NormShipment {
  const parsed = Cma.CmaCgmApiSchema.parse(payload)

  const shipment: Partial<NormShipment> = {
    source: { api: 'cmacgm', fetched_at: new Date(), raw: payload },
    origin: parsed.PlaceOfLoading ? { city: parsed.PlaceOfLoading } : undefined,
    destination: parsed.LastDischargePort ? { city: parsed.LastDischargePort } : undefined,
    containers: [],
    last_update_time: null,
    raw: payload,
  }

  const container: Partial<NormContainer> = {
    container_number: parsed.ContainerReference ?? 'unknown',
    container_size: parsed.LaraContainerCode ?? null,
    container_type: null,
    iso_code: null,
    operator: null,
    locations: [],
    eta_final_delivery: parsed.EstimatedTimeOfArrival
      ? parseDate(parsed.EstimatedTimeOfArrival)
      : null,
    status: null,
    status_code: parsed.ContainerStatus ?? null,
    last_update_time: parsed.ABPExportDate ? parseDate(parsed.ABPExportDate) : null,
    raw: parsed,
  }

  const pushMove = (m: Move | undefined) => {
    if (!m) return
    const ev: Partial<NormEvent> = {
      id: null,
      eventType: 'MOVE',
      activity: m.StatusDescription ?? null,
      event_time: m.Date ? parseDate(m.Date) : null,
      event_time_type: null,
      vessel: { vessel_name: m.Vessel ?? null, voyage_num: m.Voyage ?? null },
      location: { city: m.Location ?? null, location_code: m.LocationCode ?? null, raw: m },
      status_code: m.Status ?? null,
      status_description: m.StatusDescription ?? null,
      sourceEvent: m,
    }
    ;(container.locations as Array<Partial<NormLocation> & { events?: NormEvent[] }>).push({
      city: m.Location ?? null,
      events: [ev as NormEvent],
      raw: m,
    })
  }

  ;(parsed.ProvisionalMoves ?? []).forEach(pushMove)
  ;(parsed.CurrentMoves ?? []).forEach(pushMove)
  ;(parsed.PastMoves ?? []).forEach(pushMove)

  ;(shipment.containers as Array<Partial<NormContainer>>).push(container)

  try {
    Normalized.ShipmentSchema.parse(shipment)
  } catch (err) {
    console.warn('Normalized schema parse warning (cmacgm):', err)
  }

  return shipment as NormShipment
}
