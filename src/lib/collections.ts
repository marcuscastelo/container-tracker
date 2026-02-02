import containerStatus from '../../schemas/containerStatus.schema'
import { ShipmentsSchema as UIShipmentsSchema, Shipment as UIShipment } from '../../schemas/shipment.schema'

// Load JSON samples. Prefer Vite's import.meta.globEager when available (dev/build),
// but fall back to reading from the filesystem for SSR where globEager may not exist.
let samples: Array<{ raw: any; path: string }> = []

try {
  // @ts-ignore - import.meta may have globEager under Vite
  if (typeof (import.meta as any).globEager === 'function') {
    const modules = (import.meta as any).globEager('../../collections/**/*.json') as Record<string, any>
    samples = Object.entries(modules).map(([path, mod]) => ({ raw: (mod && (mod.default ?? mod)) || {}, path }))
  } else {
    throw new Error('no globEager')
  }
} catch (e) {
  // SSR / node fallback: read files from disk
  try {
    // Use Node APIs to recursively read JSON files under the project-level collections/ folder
    const fs = await import('fs')
    const pathMod = await import('path')
    const walk = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      const out: string[] = []
      for (const ent of entries) {
        const full = pathMod.join(dir, ent.name)
        if (ent.isDirectory()) out.push(...walk(full))
        else if (ent.isFile() && full.endsWith('.json')) out.push(full)
      }
      return out
    }
    const projectRoot = process.cwd()
    const collectionsDir = pathMod.join(projectRoot, 'collections')
    const files = walk(collectionsDir)
    samples = files.map((p) => {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
      // make path relative-ish to match previous behavior
      const rel = pathMod.relative(projectRoot, p)
      return { raw, path: rel }
    })
  } catch (err) {
    // If everything fails, keep samples empty
    samples = []
  }
}

function safeString(v: unknown) {
  if (!v && v !== 0) return ''
  return String(v)
}

// Map a normalized Shipment (containerStatus.ShipmentSchema) to the simple UI Shipment
function mapNormalizedToUI(raw: any, idx: number, path?: string): UIShipment {
  // try to find a container
  const containers = raw?.containers ?? []
  const first = containers[0] ?? {}

  const carrier = first.operator ?? raw?.source?.api ?? raw?.carrier ?? 'UNKNOWN'
  // prefer container number from normalized payload, otherwise fall back to filename (without extension), then SAMPLE
  const fileBase = path ? String(path).split('/').pop()?.replace(/\.[^.]+$/, '') : undefined
  const container_number = first.container_number ?? first.container_no ?? raw?.container_number ?? fileBase ?? `SAMPLE${idx}`
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

  samples.forEach(({ raw, path }, i) => {
    // try to validate with the comprehensive schema
    try {
      const parsed = containerStatus.ShipmentSchema.parse(raw)
      out.push(mapNormalizedToUI(parsed, i + 1, path))
      return
    } catch (e) {
      // fallback: attempt to map raw file directly
      try {
        // raw may be an object with container-centric fields
        const mapped = mapNormalizedToUI(raw, i + 1, path)
        out.push(mapped)
        return
      } catch (err) {
        // last resort: build a tiny row using filename as container
        const fileBase = path ? String(path).split('/').pop()?.replace(/\.[^.]+$/, '') : undefined
        out.push({
          process: `sample-${i + 1}`,
          client: 'N/A',
          carrier: 'N/A',
          container: fileBase ?? String(i + 1),
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
