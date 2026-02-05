import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { cmacgmToNormalized } from '~/adapters/api/cmacgm.adapter'
import { mapParsedStatusToF1 } from '~/adapters/cannonical/toCanonical.adapter'

function loadExample(name: string) {
  const p = path.resolve(process.cwd(), 'examples', name)
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

describe('cmacgm provider -> canonical mapping', () => {
  it('should produce canonical events from CMA example', () => {
    const parsedJson = loadExample('cmagcm.json')
    const norm = cmacgmToNormalized(parsedJson)
    const containers = (norm.containers || []).map((c) => {
      const locs = Array.isArray(c.locations) ? c.locations : []
      const events: unknown[] = []
      for (const L of locs) {
        if (Array.isArray(L.events)) {
          for (const ev of L.events) events.push(ev)
        }
        if (Array.isArray(L.events)) {
          for (const ev of L.events) events.push(ev)
        }
      }
      return {
        container_number: c.container_number,
        iso_code: c.iso_code ?? c.container_size ?? null,
        status: c.status ?? null,
        eta: c.eta_final_delivery ?? null,
        events,
        raw: c.raw ?? parsedJson,
      }
    })

    const parsedStatus = {
      source: { api: 'cmacgm' },
      origin: norm.origin,
      destination: norm.destination,
      containers,
      raw: parsedJson,
    }

    const res = mapParsedStatusToF1(
      parsedStatus,
      String(containers[0]?.container_number ?? 'unknown'),
      'cmacgm',
    )
    if (!res.ok) {
      throw new Error(`toCanonical mapping failed: ${res.error}`)
    }
    const shipment = res.shipment
    expect(Array.isArray(shipment.containers)).toBe(true)
    expect(shipment.containers.length).toBeGreaterThan(0)
    const c = shipment.containers[0]
    expect(Array.isArray(c.events)).toBe(true)
    expect((c.events || []).length).toBeGreaterThan(0)
  })
})
