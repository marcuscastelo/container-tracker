import type {
  Container as NormContainer,
  Event as NormEvent,
  Location as NormLocation,
  Shipment as NormShipment,
} from '~/modules/container/domain/schemas/containerStatus.schema'
import * as Normalized from '~/modules/container/domain/schemas/containerStatus.schema'
import type { CmaCgmApi } from '~/modules/container/infrastructure/schemas/api/cmacgm.api.schema'
import * as Cma from '~/modules/container/infrastructure/schemas/api/cmacgm.api.schema'
import { parseDate } from '~/shared/utils/parseDate'

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
    // ensure locations is an array and push a normalized location object
    let locs: unknown[] = []
    if (Array.isArray(container.locations)) locs = container.locations
    const newLoc = {
      city: m.Location ?? null,
      events: [ev],
      raw: m,
    }
    locs.push(newLoc)
    container.locations = locs
  }

  ;(parsed.ProvisionalMoves ?? []).forEach(pushMove)
  ;(parsed.CurrentMoves ?? []).forEach(pushMove)
  ;(parsed.PastMoves ?? []).forEach(pushMove)

  // append container to shipment.containers
  if (!Array.isArray(shipment.containers)) shipment.containers = []
  shipment.containers.push(container)

  try {
    // attempt to validate and return the parsed normalized shipment
    return Normalized.ShipmentSchema.parse(shipment)
  } catch (err) {
    console.warn('Normalized schema parse warning (cmacgm):', err)
    // fallback: coerce to any-shaped object and return to preserve previous behavior
    return shipment
  }
}
