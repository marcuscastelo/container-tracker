import { z } from 'zod'

// Copied from modules/process/domain/process.ts — migrating Process domain into shipment module

export const OperationType = z.enum(['import', 'export', 'transshipment', 'unknown'])
export type OperationType = z.infer<typeof OperationType>

export const ProcessSource = z.enum(['manual', 'api', 'import'])
export type ProcessSource = z.infer<typeof ProcessSource>

export const Carrier = z.enum(['maersk', 'msc', 'cmacgm', 'hapag', 'one', 'evergreen', 'unknown'])
export type Carrier = z.infer<typeof Carrier>

export const PlannedLocation = z.object({
  display_name: z.string().nullable().optional(),
  unlocode: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
})
export type PlannedLocation = z.infer<typeof PlannedLocation>

export const ContainerInitialStatus = z.enum(['unknown', 'booked'])
export type ContainerInitialStatus = z.infer<typeof ContainerInitialStatus>

export const ProcessContainerSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  container_number: z
    .string()
    .min(1)
    .transform((v) => v.toUpperCase().trim()),
  iso_type: z.string().nullable().optional(),
  initial_status: ContainerInitialStatus.default('unknown'),
  source: ProcessSource.default('manual'),
  created_at: z.date(),
  updated_at: z.date(),
})
export type ProcessContainer = z.infer<typeof ProcessContainerSchema>

export const ProcessSchema = z.object({
  id: z.string().uuid(),
  reference: z.string().nullable().optional(),
  operation_type: OperationType.default('unknown'),
  origin: PlannedLocation.nullable().optional(),
  destination: PlannedLocation.nullable().optional(),
  carrier: Carrier.nullable().optional(),
  bl_reference: z.string().nullable().optional(),
  booking_reference: z.string().nullable().optional(),
  source: ProcessSource.default('manual'),
  created_at: z.date(),
  updated_at: z.date(),
})
export type Process = z.infer<typeof ProcessSchema>

export const CreateProcessInputSchema = z.object({
  reference: z.string().nullable().optional(),
  operation_type: OperationType.optional(),
  origin: z
    .object({
      display_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  destination: z
    .object({
      display_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  carrier: Carrier.nullable().optional(),
  bl_reference: z.string().nullable().optional(),
  containers: z
    .array(
      z.object({
        container_number: z.string().min(1),
        iso_type: z.string().nullable().optional(),
        initial_status: ContainerInitialStatus.optional(),
      }),
    )
    .min(1, 'At least one container is required'),
})
export type CreateProcessInput = z.infer<typeof CreateProcessInputSchema>

export const ProcessWithContainersSchema = ProcessSchema.extend({
  containers: z.array(ProcessContainerSchema),
})
export type ProcessWithContainers = z.infer<typeof ProcessWithContainersSchema>

export function validateContainerNumber(containerNumber: string): {
  valid: boolean
  message?: string
} {
  const normalized = containerNumber.toUpperCase().trim()

  if (normalized.length === 0) {
    return { valid: false, message: 'Container number is required' }
  }

  const iso6346Regex = /^[A-Z]{4}[0-9]{7}$/
  if (!iso6346Regex.test(normalized)) {
    return {
      valid: true,
      message: `Container number may be invalid. Expected format: 4 letters + 7 digits (e.g., MSCU1234567)`,
    }
  }

  return { valid: true }
}

export function findDuplicateContainers(containerNumbers: readonly string[]): readonly string[] {
  const normalized = containerNumbers.map((n) => n.toUpperCase().trim())
  const seen = new Set<string>()
  const duplicates: string[] = []

  for (const num of normalized) {
    if (seen.has(num)) {
      duplicates.push(num)
    } else {
      seen.add(num)
    }
  }

  return duplicates
}

export function createProcess(input: CreateProcessInput): {
  process: Omit<Process, 'id' | 'created_at' | 'updated_at'>
  containers: readonly Omit<ProcessContainer, 'id' | 'process_id' | 'created_at' | 'updated_at'>[]
} {
  const process: Omit<Process, 'id' | 'created_at' | 'updated_at'> = {
    reference: input.reference ?? null,
    operation_type: input.operation_type ?? 'unknown',
    origin: input.origin?.display_name ? { display_name: input.origin.display_name } : null,
    destination: input.destination?.display_name
      ? { display_name: input.destination.display_name }
      : null,
    carrier: input.carrier ?? null,
    bl_reference: input.bl_reference ?? null,
    booking_reference: null,
    source: 'manual',
  }

  const containers = input.containers.map((c) => ({
    container_number: c.container_number.toUpperCase().trim(),
    iso_type: c.iso_type ?? null,
    initial_status: c.initial_status ?? ('unknown' as const),
    source: 'manual' as const,
  }))

  return { process, containers }
}
