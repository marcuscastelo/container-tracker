import type { APIEvent } from '@solidjs/start/server'
import { alertUseCases } from '~/modules/alert'
import { containerStatusUseCases } from '~/modules/container'
import { CreateProcessInputSchema, processUseCases } from '~/modules/process'
import type { UpdateProcessInput } from '~/modules/process/application/processUseCases'

// Helper to create JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// GET /api/processes/[id] - Get a single process with containers
export async function GET({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    const process = await processUseCases.getProcessWithContainers(processId)
    if (!process) {
      return jsonResponse({ error: 'Process not found' }, 404)
    }

    // Get alerts for this process
    const alerts = await alertUseCases.getAlertsForProcess(processId)

    const response = {
      id: process.id,
      reference: process.reference,
      operation_type: process.operation_type,
      origin: process.origin,
      destination: process.destination,
      carrier: process.carrier,
      // TODO: Rename to bill_of_lading in the future, with type safe zod schema and typescript refactor
      bl_reference: process.bill_of_lading,
      source: process.source,
      created_at: process.created_at.toISOString(),
      updated_at: process.updated_at.toISOString(),
      containers: await Promise.all(
        process.containers.map(async (c) => {
          // Attempt to enrich container with canonical status/events from container-status table
          try {
            const cs = await containerStatusUseCases.getContainerStatus(c.container_number)
            const csStr = cs && cs.status ? JSON.stringify(cs.status).slice(0, 2000) : null
            console.debug(
              `GET /api/processes/[id]: enriching container ${c.container_number} with container-status:`,
              csStr,
            )
            if (cs) {
              // cs.status is expected to be the canonical shipment payload saved by refresh,
              // however some rows/variants may store the canonical shape at the root or under
              // other keys. Build a permissive canonical object and try multiple heuristics.
              const canonical = (cs.status ?? cs) as any

              // helper to find the f1 container inside a canonical-shaped object
              const findF1Container = (payload: any, containerNumber: string) => {
                if (!payload) return null
                // common normalized path: payload.containers[] with container_number
                if (Array.isArray(payload.containers)) {
                  const hit = payload.containers.find(
                    (x: any) =>
                      (
                        x.container_number ||
                        x.ContainerNumber ||
                        x.Container ||
                        x.containerNumber ||
                        ''
                      ).toString() === containerNumber,
                  )
                  if (hit) return hit
                }

                // sometimes the canonical payload is nested under payload.source.raw or payload.raw
                const candidates = [
                  payload.raw,
                  payload.source?.raw,
                  payload.status?.raw,
                  payload.Data,
                ]
                for (const cand of candidates) {
                  try {
                    // MSC style: Data.BillOfLadings[].ContainersInfo[].ContainerNumber or ContainerNumber inside ContainersInfo
                    const bls = cand?.Data?.BillOfLadings || cand?.BillOfLadings || []
                    for (const bl of bls) {
                      const cis = bl?.ContainersInfo || bl?.containers || []
                      for (const ci of cis) {
                        // some shapes put ContainerNumber at this level
                        const num =
                          ci?.ContainerNumber ||
                          ci?.Container ||
                          ci?.ContainerNumberString ||
                          ci?.ContainerNumber
                        if (num && num.toString() === containerNumber) return ci
                        // or inside ci itself there may be a ContainerNumber field inside nested object
                        if (
                          ci?.ContainerNumber &&
                          ci.ContainerNumber.toString() === containerNumber
                        )
                          return ci
                        // some shapes put the ContainerNumber at a deeper place
                        if (Array.isArray(ci?.Events)) return ci // return container info if Events exist
                      }
                    }
                  } catch (_e) {
                    // ignore
                  }
                }

                return null
              }

              const f1container = findF1Container(canonical, c.container_number)

              // helper to extract events from various carrier raw shapes
              const extractEventsFromRaw = (raw: any): any[] => {
                if (!raw) return []
                // MSC style: raw.Data.BillOfLadings[0].ContainersInfo[0].Events
                try {
                  const bl = raw?.Data?.BillOfLadings?.[0]
                  const ci = bl?.ContainersInfo?.[0]
                  if (Array.isArray(ci?.Events) && ci.Events.length > 0) return ci.Events
                } catch (_e) {}
                // fallback: raw.Events array
                if (Array.isArray(raw?.Events) && raw.Events.length > 0) return raw.Events
                // fallback: top-level Events
                if (Array.isArray(raw?.Events) && raw.Events.length > 0) return raw.Events
                return []
              }

              let rawEvents: any[] = []
              if (Array.isArray(f1container?.events) && f1container.events.length > 0) {
                rawEvents = f1container.events
              } else if (Array.isArray(f1container?.Events) && f1container.Events.length > 0) {
                // some carrier shapes use capitalized Events directly on the container info
                rawEvents = f1container.Events
              } else {
                // try several raw locations: container-level raw, container info raw, canonical raw, source.raw
                rawEvents = extractEventsFromRaw(
                  f1container?.raw ?? f1container ?? canonical?.raw ?? canonical?.source?.raw ?? {},
                )
              }

              const parseDateLike = (d: any) => {
                if (!d) return null
                if (typeof d === 'string') {
                  // handle common dd/mm/yyyy or dd/mm/yyyy HH:MM formats used by carriers
                  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/)
                  if (m) {
                    const day = Number(m[1])
                    const month = Number(m[2]) - 1
                    const year = Number(m[3])
                    const hour = m[4] ? Number(m[4]) : 0
                    const minute = m[5] ? Number(m[5]) : 0
                    return new Date(Date.UTC(year, month, day, hour, minute)).toISOString()
                  }
                  // fallback to Date constructor
                  const parsed = new Date(d)
                  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
                }
                if (typeof d === 'number') {
                  const parsed = new Date(d)
                  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
                }
                if (d instanceof Date) return isNaN(d.getTime()) ? null : d.toISOString()
                return null
              }

              const events = (rawEvents ?? [])
                .map((ev: any, idx: number) => {
                  const id = ev.id ?? ev.EventId ?? ev.Id ?? `ev-${idx}`
                  const dateVal =
                    ev.event_time ?? ev.Date ?? ev.DateString ?? ev.DateTime ?? ev?.eventTime
                  const eventTime = parseDateLike(dateVal)
                  const eventTimeType = ev.event_time_type ?? ev.EventTimeType ?? undefined
                  const activity = ev.activity ?? ev.Activity ?? ev.Description ?? undefined
                  const location =
                    ev.location ?? ev.Location ?? ev.UnLocationCode ?? ev?.Location ?? undefined
                  return {
                    id,
                    activity,
                    event_time: eventTime,
                    event_time_type: eventTimeType,
                    location,
                    raw: ev,
                  }
                })
                .filter(Boolean)

              // sort events by event_time (ascending)
              events.sort((a: any, b: any) => {
                const ta = a.event_time ? new Date(a.event_time).getTime() : 0
                const tb = b.event_time ? new Date(b.event_time).getTime() : 0
                return ta - tb
              })

              return {
                id: c.id,
                container_number: c.container_number,
                iso_type: c.iso_type,
                initial_status: c.initial_status,
                eta:
                  (f1container && f1container.eta) || (canonical && canonical.eta)
                    ? new Date((f1container?.eta ?? canonical?.eta) as string).toISOString()
                    : null,
                events,
              }
            }
          } catch (e) {
            console.warn('GET /api/processes/[id]: failed to enrich container status', e)
          }

          return {
            id: c.id,
            container_number: c.container_number,
            iso_type: c.iso_type,
            initial_status: c.initial_status,
          }
        }),
      ),
      alerts: alerts.map((a) => ({
        id: a.id,
        category: a.category,
        code: a.code,
        severity: a.severity,
        title: a.title,
        description: a.description,
        state: a.state,
        created_at: a.created_at.toISOString(),
      })),
    }

    return jsonResponse(response)
  } catch (err) {
    console.error('GET /api/processes/[id] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}

// DELETE /api/processes/[id] - Delete a process and all its containers
export async function DELETE({ params }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    // Check if process exists
    const process = await processUseCases.getProcess(processId)
    if (!process) {
      return jsonResponse({ error: 'Process not found' }, 404)
    }

    await processUseCases.deleteProcess(processId)

    return jsonResponse({ success: true, deleted: processId })
  } catch (err) {
    console.error('DELETE /api/processes/[id] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}

// PATCH /api/processes/[id] - Update process fields and containers
export async function PATCH({ params, request }: APIEvent): Promise<Response> {
  try {
    const processId = params.id
    if (!processId) {
      return jsonResponse({ error: 'Process ID is required' }, 400)
    }

    const rawBody = await request.json().catch(() => ({}))
    // Allow partial updates - reuse CreateProcessInputSchema but optional
    const parsed = CreateProcessInputSchema.partial().safeParse(rawBody)
    if (!parsed.success) {
      return jsonResponse({ error: `Invalid request: ${parsed.error.message}` }, 400)
    }

    // Map incoming containers to UI-friendly shape if present
    const input: UpdateProcessInput = {}
    if (parsed.data.reference !== undefined) input.reference = parsed.data.reference
    if (parsed.data.operation_type !== undefined) input.operationType = parsed.data.operation_type
    if (parsed.data.origin !== undefined) input.origin = parsed.data.origin
    if (parsed.data.destination !== undefined) input.destination = parsed.data.destination
    if (parsed.data.carrier !== undefined) input.carrier = parsed.data.carrier
    if (parsed.data.bill_of_lading !== undefined) input.billOfLading = parsed.data.bill_of_lading
    if (parsed.data.containers !== undefined) {
      input.containers = parsed.data.containers.map((c: any) => ({
        containerNumber: c.container_number,
        isoType: c.iso_type ?? null,
      }))
    }

    const updated = await processUseCases.updateProcess(processId, input)

    const response = {
      id: updated.id,
      reference: updated.reference,
      operation_type: updated.operation_type,
      origin: updated.origin,
      destination: updated.destination,
      carrier: updated.carrier,
      bl_reference: updated.bill_of_lading,
      source: updated.source,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
      containers: updated.containers.map((c) => ({
        id: c.id,
        container_number: c.container_number,
        iso_type: c.iso_type,
        initial_status: c.initial_status,
      })),
    }

    return jsonResponse(response)
  } catch (err) {
    console.error('PATCH /api/processes/[id] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
}
