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
    try { console.log('collections: loaded (globEager):', Object.keys(modules)) } catch (e) { }
  } else {
    throw new Error('no globEager')
  }
} catch (e) {
  // SSR / node fallback: read files from disk
  try {
    console.warn('collections: import.meta.globEager not available — falling back to filesystem read')
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
    try { console.log('collections: loaded (fs):', samples.map(s => s.path)) } catch (err) { }
  } catch (err) {
    // If everything fails, keep samples empty
    try { console.error('collections: failed to load samples via fs fallback', err) } catch (e) { }
    samples = []
  }
}

function safeString(v: unknown) {
  if (!v && v !== 0) return ''
  return String(v)
}

// Map a normalized Shipment (containerStatus.ShipmentSchema) to the simple UI Shipment
function mapNormalizedToUI(raw: any, idx: number, path?: string): UIShipment {
  console.debug(`collections: mapping sample #${idx} (${path})`)
  // try to find a container
  const containers = raw?.containers ?? []
  const first = containers[0] ?? {}

  // derive carrier (armador) preferring normalized fields, otherwise infer from folder name in path
  const rawCarrier = first.operator ?? raw?.source?.api ?? raw?.carrier
  const normPath = path ? String(path).replace(/\\/g, '/') : undefined
  const folderBase = normPath ? normPath.split('/').slice(-2)[0] : undefined
  const carrier = rawCarrier ?? (folderBase ? folderBase.toUpperCase() : undefined) ?? 'UNKNOWN'
  // prefer container number from normalized payload, otherwise fall back to filename (without extension), then SAMPLE
  const fileBase = path ? String(path).split('/').pop()?.replace(/\.[^.]+$/, '') : undefined
  const container_number = first.container_number ?? first.container_no ?? raw?.container_number ?? fileBase ?? `SAMPLE${idx}`
  const client = raw?.client_name ?? raw?.source?.api ?? 'Cliente Teste'

  // derive origin/destination from multiple possible payload shapes
  let origin = ''
  let destination = ''

  // 1) normalized fields
  if (raw?.origin?.city) origin = raw.origin.city
  if (raw?.destination?.city) destination = raw.destination.city
  console.debug('after normalized:', { origin, destination })

  // 2) container locations array (first and last)
  if ((!origin || !destination) && Array.isArray(containers) && containers.length > 0) {
    const locs = first?.locations ?? []
    if (locs && locs.length > 0) {
      if (!origin) origin = locs[0]?.city ?? locs[0]?.Location ?? ''
      if (!destination) {
        const last = locs[locs.length - 1]
        destination = last?.city ?? last?.Location ?? ''
        try { console.debug(`collections: used container locations for origin/destination (${fileBase ?? path})`) } catch (e) { }
      }
    }
    console.debug('after fallback locs:', { origin, destination })
  }

  // 3) MSC style: Data.BillOfLadings[0].GeneralTrackingInfo
  if ((!origin || !destination) && raw?.Data?.BillOfLadings && raw.Data.BillOfLadings[0]) {
    const info = raw.Data.BillOfLadings[0].GeneralTrackingInfo
    if (info) {
      if (!origin) origin = info.PortOfLoad ?? info.ShippedFrom ?? origin
      if (!destination) destination = info.PortOfDischarge ?? info.ShippedTo ?? destination
      try { console.debug(`collections: used MSC BillOfLadings GeneralTrackingInfo for (${fileBase ?? path})`) } catch (e) { }
    }
    console.debug('after fallback MSC:', { origin, destination })
  }

  console.debug('Raw data for fallbacks:', raw)
  // 4) CMA CGM style top-level fields
  if ((!origin || !destination) && (raw?.Reciept || raw?.LastDischargePort || raw?.POL || raw?.POD)) {
    if (!origin) origin = raw.Reciept ?? raw.POL ?? origin
    if (!destination) destination = raw.LastDischargePort ?? raw.POD ?? destination
    try { console.debug(`collections: used CMA-CGM fields (Reciept/LastDischargePort/POL/POD) for (${fileBase ?? path})`) } catch (e) { }
    console.debug('after fallback CMA CGM:', { origin, destination })
  }

  // 5) fallback route or displays
  if (!origin && raw?.origin_display) origin = raw.origin_display
  if (!destination && raw?.destination_display) destination = raw.destination_display

  // final fallback: route string
  const routeFromRaw = raw?.route ?? raw?.route_display ?? ''
  if ((!origin || !destination) && routeFromRaw && typeof routeFromRaw === 'string') {
    const parts = routeFromRaw.split(/→|->|–|-/).map((p: string) => p.trim())
    if (!origin && parts[0]) origin = parts[0]
    if (!destination && parts[1]) destination = parts[1]
    try { console.debug(`collections: used route string fallback for (${fileBase ?? path}):`, routeFromRaw) } catch (e) { }
    console.debug('after fallback route string:', { origin, destination })
  }
  console.debug('final origin/destination:', { origin, destination })

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

  // debug logs for fallbacks
  try {
    if (!rawCarrier && folderBase) console.debug(`collections: inferred carrier '${carrier}' from folder '${folderBase}' for ${fileBase ?? path}`)
    if (!first.container_number && !raw?.container_number && fileBase) console.debug(`collections: using filename '${fileBase}' as container number for ${fileBase}`)
  } catch (e) { }

  return s
}

export function getPoCShipments(): UIShipment[] {
  const out: UIShipment[] = []

  samples.forEach(({ raw, path }, i) => {
    console.debug(`collections: processing sample #${i + 1} (${path})`)
    // try to validate with the comprehensive schema
    try {
      console.debug(`collections: attempting to parse sample #${i + 1} with normalized schema (${path})`)
      const parsed = containerStatus.ShipmentSchema.parse(raw)
      out.push(mapNormalizedToUI(parsed, i + 1, path))
      return
    } catch (e) {
      console.debug(`collections: sample #${i + 1} did not match normalized schema, attempting UI schema (${path})`)
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
