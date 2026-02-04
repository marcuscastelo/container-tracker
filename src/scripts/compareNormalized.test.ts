// @ts-nocheck
/// <reference types="vitest" />
import fs from 'fs'
import path from 'path'
import { it } from 'vitest'

function load(file: string) {
  const p = path.resolve(process.cwd(), '.output', file)
  const raw = fs.readFileSync(p, 'utf-8')
  return JSON.parse(raw)
}

function countEvents(container: unknown) {
  let cnt = 0
  if (Array.isArray(container.events)) cnt += container.events.length
  if (Array.isArray(container.locations)) {
    for (const loc of container.locations) {
      if (Array.isArray(loc.events)) cnt += loc.events.length
      // some raw events arrays may be under different keys
      if (Array.isArray(loc.Events)) cnt += loc.Events.length
    }
  }
  return cnt
}

function summarize(name: string, obj: unknown) {
  const containers = obj.containers ?? obj.containers ?? []
  const cCount = Array.isArray(containers) ? containers.length : 0
  let events = 0
  const perContainer: Array<{ container_number?: string; events: number }> = []
  for (const c of containers) {
    const ev = countEvents(c)
    events += ev
    perContainer.push({
      container_number: c.container_number ?? c.container_num ?? c.ContainerNumber,
      events: ev,
    })
  }
  const firstKeys = cCount > 0 ? Object.keys(containers[0]) : []
  return {
    name,
    containerCount: cCount,
    totalEvents: events,
    perContainer,
    firstContainerKeys: firstKeys,
  }
}

it('compare normalized outputs for consistency', () => {
  const files = [
    { file: 'msc.normalized.json', name: 'MSC' },
    { file: 'cmacgm.normalized.json', name: 'CMA CGM' },
    { file: 'maersk.normalized.json', name: 'MAERSK' },
  ]

  const reports = files.map((f) => ({ ...f, data: summarize(f.name, load(f.file)) }))

  console.log('\n=== Normalized adapters consistency report ===')
  for (const r of reports) {
    console.log(`\nProvider: ${r.name}`)
    console.log(`  containers: ${r.data.containerCount}`)
    console.log(`  total events: ${r.data.totalEvents}`)
    for (const pc of r.data.perContainer) {
      console.log(`    - ${pc.container_number ?? '<unknown>'}: ${pc.events} events`)
    }
    console.log(`  first container keys: ${r.data.firstContainerKeys.join(', ')}`)
  }

  // Simple cross-checks
  const containerCounts = reports.map((r) => r.data.containerCount)
  const totalEvents = reports.map((r) => r.data.totalEvents)

  console.log('\nCross-checks:')
  console.log(`  container counts (msc, cmacgm, maersk): ${containerCounts.join(', ')}`)
  console.log(`  total events (msc, cmacgm, maersk): ${totalEvents.join(', ')}`)

  // Expectations (lenient): each should have >=1 container and >=0 events
  for (const r of reports) {
    if (r.data.containerCount < 1) throw new Error(`${r.name} has no containers`)
  }

  // If you want a stricter consistency rule, we can add it here.
})
