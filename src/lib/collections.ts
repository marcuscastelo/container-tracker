import containerStatus from '../../schemas/containerStatus.schema'
import { ShipmentsSchema as UIShipmentsSchema, Shipment as UIShipment } from '../../schemas/shipment.schema'

// Import a few sample JSONs from collections (PoC). Adjust filenames if you add/remove samples.
import maerskSample from '../../collections/maersk/MNBU3094033.json'
import mscSample from '../../collections/msc/CXDU2058677.json'
import cmacgmSample from '../../collections/cmacgm/FSCU4565494.json'

const samples = [maerskSample, mscSample, cmacgmSample]

function safeString(v: unknown) {
  if (!v && v !== 0) return ''
  return String(v)
}

// Map a normalized Shipment (containerStatus.ShipmentSchema) to the simple UI Shipment
function mapNormalizedToUI(raw: any, idx: number): UIShipment {
  // try to find a container
  const containers = raw?.containers ?? []
  const first = containers[0] ?? {}

  const carrier = first.operator ?? raw?.source?.api ?? raw?.carrier ?? 'UNKNOWN'
  const container_number = first.container_number ?? first.container_no ?? raw?.container_number ?? `SAMPLE${idx}`
  const client = raw?.client_name ?? raw?.source?.api ?? 'Cliente Teste'
  const origin = raw?.origin?.city ?? raw?.origin_display ?? ''
  const destination = raw?.destination?.city ?? raw?.destination_display ?? ''

  const etaDate = first?.eta_final_delivery ?? raw?.eta ?? raw?.last_update_time
  const eta = etaDate ? (typeof etaDate === 'string' ? etaDate : (new Date(etaDate)).toLocaleDateString()) : ''

  const status = first?.status ?? raw?.current_status ?? raw?.status ?? 'Desconhecido'

  const s: UIShipment = {
    process: safeString(raw?.process ?? raw?.process_id ?? `2024-0${100 + idx}`),
    client: safeString(client),
    carrier: safeString(carrier),
    container: safeString(container_number),
    route: origin && destination ? `${origin} → ${destination}` : safeString(raw?.route ?? raw?.route_display ?? ''),
    status: safeString(status),
    eta: eta || safeString(raw?.eta_display ?? raw?.eta ?? ''),
    statusClass: raw?.status_level === 'danger' ? 'bg-red-500 text-white' : undefined,
  }

  return s
}

export function getPoCShipments(): UIShipment[] {
  const out: UIShipment[] = []

  samples.forEach((raw, i) => {
    // try to validate with the comprehensive schema
    try {
      const parsed = containerStatus.ShipmentSchema.parse(raw)
      out.push(mapNormalizedToUI(parsed, i + 1))
      return
    } catch (e) {
      // fallback: attempt to map raw file directly
      try {
        // raw may be an object with container-centric fields
        const mapped = mapNormalizedToUI(raw, i + 1)
        out.push(mapped)
        return
      } catch (err) {
        // last resort: build a tiny row
        out.push({
          process: `sample-${i + 1}`,
          client: 'N/A',
          carrier: 'N/A',
          container: String(i + 1),
          route: 'N/A',
          status: 'N/A',
          eta: '',
        })
      }
    }
  })

  // Ensure the result matches the simple UI schema (best-effort)
  try {
    return UIShipmentsSchema.parse(out)
  } catch (e) {
    // if validation fails, return out as-is (PoC tolerant)
    return out as any
  }
}

export default { getPoCShipments }
