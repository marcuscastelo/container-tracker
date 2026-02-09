import { z } from 'zod'
import type z4 from 'zod/v4'
import { alertUseCases } from '~/modules/alert'
import type { NewContainer } from '~/modules/container/domain/container'
import type { getRestProvider } from '~/modules/container-events/infrastructure/api/refresh/refresh-providers'
import { type CreateProcessInput, processUseCases } from '~/modules/process'
import { CarrierSchema } from '~/modules/process/domain/value-objects'

// --- Helpers ---
export function respondWithSchema<T>(
  payload: T,
  schema: z4.ZodTypeAny,
  status = 200,
  extraHeaders?: Record<string, string>,
) {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    console.error('refresh: response validation failed', parsed.error.format())
    return new Response(JSON.stringify({ error: 'response validation failed' }), { status: 500 })
  }
  const headers = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {})
  return new Response(JSON.stringify(parsed.data), { status, headers })
}

// TODO: Test if sanitizeValue is actually needed or if we can remove it
function sanitizeValue(v: unknown): unknown {
  if (typeof v === 'string') {
    // Remove literal backslash-u0000 sequences and actual NUL characters
    return v.replace(/\\u0000/g, '').replace(/\u0000/g, '')
  }
  if (Array.isArray(v)) return v.map(sanitizeValue)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      out[k] = sanitizeValue(val)
    }
    return out
  }
  return v
}

export async function fetchAndSanitizeContainerEvents(
  handler: NonNullable<ReturnType<typeof getRestProvider>>,
  container: string,
) {
  let result: { parsedEvents?: Record<string, unknown>; raw?: string } | undefined
  try {
    console.debug(
      `refresh: invoking handler for provider='${handler.name}' container='${container}'`,
    )
    result = await handler.fetchStatus(String(container))
  } catch (err) {
    console.error('refresh: provider fetch failed', err)
    return { error: `provider fetch failed: ${String(err)}` }
  }

  const parsedEvents = sanitizeValue(
    result?.parsedEvents ?? (typeof result?.raw === 'string' ? { raw: result.raw } : { raw: '' }),
  )

  return { parsedEvents }
}

// TODO: Review canonicall shipment schema, probably deprecated
export const CanonicalShipmentSchema = z.object({
  containers: z.array(
    z.object({
      container_number: z.string().optional(),
      container_no: z.string().optional(),
    }),
  ),
  origin: z.object({ city: z.string().optional() }).optional(),
  destination: z.object({ city: z.string().optional() }).optional(),
  carrier: CarrierSchema,
})

function hasMessage(e: unknown): e is { message?: unknown } {
  return typeof e === 'object' && e !== null && 'message' in e
}

export function buildCreateProcessInput(
  shipment: z.infer<typeof CanonicalShipmentSchema>,
): CreateProcessInput {
  return {
    reference: null,
    operation_type: 'import',
    origin: shipment.origin ? { display_name: shipment.origin.city ?? null } : null,
    destination: shipment.destination ? { display_name: shipment.destination.city ?? null } : null,
    carrier: CarrierSchema.safeParse(shipment.carrier).success
      ? CarrierSchema.parse(shipment.carrier)
      : 'unknown',
    bill_of_lading: null,
    containers: shipment.containers.map(
      (c) =>
        ({
          container_number: String(c.container_number ?? c.container_no ?? '').toUpperCase(),
          carrier_code: shipment.carrier,
        }) satisfies Omit<NewContainer, 'process_id'>,
    ),
  }
}

export async function createInitialAlerts(processId: string, containers: readonly NewContainer[]) {
  try {
    await alertUseCases.createProcessCreatedAlerts({
      process_id: processId,
      container_ids: containers.map((c) => c.container_number),
    })
  } catch (ae) {
    console.warn('refresh: failed to create initial alerts for imported process', ae)
  }
}

export async function reconcileProcessOnCreateError(
  createErr: unknown,
  container: string,
  createInput: CreateProcessInput,
) {
  const msg = hasMessage(createErr) ? String(createErr.message ?? createErr) : String(createErr)
  console.warn('refresh: createProcess failed, attempting reconciliation:', msg)
  try {
    const all = await processUseCases.getAllProcessesWithContainers()
    const normalized = String(container).toUpperCase().trim()
    const found = all.find((p) => p.containers.some((c) => c.container_number === normalized))
    if (found) {
      const updates: Record<string, unknown> = {}
      if (!found.carrier && createInput.carrier) updates.carrier = createInput.carrier
      if ((!found.origin || !found.origin.display_name) && createInput.origin)
        updates.origin = createInput.origin
      if ((!found.destination || !found.destination.display_name) && createInput.destination)
        updates.destination = createInput.destination
      if (Object.keys(updates).length > 0) {
        await processUseCases.updateProcess(found.id, updates)
        console.log(`refresh: reconciled process ${found.id} for container ${container}`)
      }
    }
  } catch (recErr) {
    console.warn('refresh: reconciliation attempt failed', recErr)
  }
}
