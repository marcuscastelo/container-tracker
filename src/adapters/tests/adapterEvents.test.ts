import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { cmacgmToNormalized } from '~/adapters/cmacgm.adapter'
import { maerskToNormalized } from '~/adapters/maersk.adapter'
import { mscToNormalized } from '~/adapters/msc.adapter'

function loadExample(name: string) {
  const p = path.resolve(process.cwd(), 'examples', name)
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

function containerHasEvents(container: {
  events?: unknown[]
  locations?: Array<{ events?: unknown[]; Events?: unknown[] }>
}): boolean {
  // events can be on container.events or inside locations[].events
  if (Array.isArray(container.events) && container.events.length > 0) return true
  if (Array.isArray(container.locations)) {
    for (const loc of container.locations) {
      if (Array.isArray(loc.events) && loc.events.length > 0) return true
      // some adapters put events directly on the location object
      if (Array.isArray(loc?.Events) && loc.Events.length > 0) return true
    }
  }
  return false
}

describe('Adapters emit events in normalized output', () => {
  it('Maersk example should contain events in normalized container', () => {
    const maersk = loadExample('maersk.json')
    const norm = maerskToNormalized(maersk)
    const containers = norm.containers ?? []
    expect(Array.isArray(containers)).toBe(true)
    expect(containers.length).toBeGreaterThan(0)
    const c = containers[0]
    expect(containerHasEvents(c)).toBe(true)
  })

  it('MSC example should contain events in normalized container', () => {
    const msc = loadExample('msc.json')
    const norm = mscToNormalized(msc)
    const containers = norm.containers ?? []
    expect(Array.isArray(containers)).toBe(true)
    expect(containers.length).toBeGreaterThan(0)
    const c = containers[0]
    expect(containerHasEvents(c)).toBe(true)
  })

  it('CMA CGM example should contain events in normalized container', () => {
    const cma = loadExample('cmagcm.json')
    const norm = cmacgmToNormalized(cma)
    const containers = norm.containers ?? []
    expect(Array.isArray(containers)).toBe(true)
    expect(containers.length).toBeGreaterThan(0)
    const c = containers[0]
    expect(containerHasEvents(c)).toBe(true)
  })
})
