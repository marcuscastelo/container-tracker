import { z } from 'zod'

/**
 * Process (Shipment) Domain Model
 *
 * A Process is a logical grouping created by the user to track one or more containers.
 * It represents the INTENTION, not the reality - it can exist with incomplete data.
 *
 * Key decisions (from brainstorm):
 * - Process is always created manually (source = 'manual')
 * - Status is DERIVED from containers, never stored directly
 * - Origin/Destination are INTENTIONAL, not observed
 * - A Process must have at least 1 container
 */

// Operation type enum - explicit choice, defaults to 'unknown'
export const OperationType = z.enum(['import', 'export', 'transshipment', 'unknown'])
export type OperationType = z.infer<typeof OperationType>

// Source of the process data
export const ProcessSource = z.enum(['manual', 'api', 'import'])
export type ProcessSource = z.infer<typeof ProcessSource>

// Carrier enum (extensible)
export const Carrier = z.enum(['maersk', 'msc', 'cmacgm', 'hapag', 'one', 'evergreen', 'unknown'])
export type Carrier = z.infer<typeof Carrier>

// Location for planned route (intentional, not observed)
export const PlannedLocation = z.object({
  display_name: z.string().nullable().optional(), // Free text like "Santos" or "BRSSZ"
  unlocode: z.string().nullable().optional(), // UN/LOCODE when known
  city: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
})
export type PlannedLocation = z.infer<typeof PlannedLocation>

// Container initial status - explicit choice
export const ContainerInitialStatus = z.enum(['unknown', 'booked'])
export type ContainerInitialStatus = z.infer<typeof ContainerInitialStatus>

/**
 * ProcessContainer - a container associated with a process
 * This is the user's declaration, not the tracking data
 */
export const ProcessContainerSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  container_number: z
    .string()
    .min(1)
    .transform((v) => v.toUpperCase().trim()),
  iso_type: z.string().nullable().optional(), // e.g., "40HC", "20GP"
  initial_status: ContainerInitialStatus.default('unknown'),
  source: ProcessSource.default('manual'),
  created_at: z.date(),
  updated_at: z.date(),
})
export type ProcessContainer = z.infer<typeof ProcessContainerSchema>

/**
 * Process (Shipment) Schema - the main entity
 */
export const ProcessSchema = z.object({
  id: z.string().uuid(),
  // User-provided reference (optional, not unique)
  reference: z.string().nullable().optional(),
  // Operation type (import/export/etc)
  operation_type: OperationType.default('unknown'),
  // Planned route (intentional, may differ from actual)
  origin: PlannedLocation.nullable().optional(),
  destination: PlannedLocation.nullable().optional(),
  // Source/Integration metadata
  carrier: Carrier.nullable().optional(),
  bl_reference: z.string().nullable().optional(),
  booking_reference: z.string().nullable().optional(),
  // Process metadata
  source: ProcessSource.default('manual'),
  created_at: z.date(),
  updated_at: z.date(),
  // Containers are fetched separately, not embedded in the schema
})
export type Process = z.infer<typeof ProcessSchema>

/**
 * Schema for creating a new process (input from UI)
 */
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

/**
 * ProcessWithContainers - the full view of a process with its containers
 */
export const ProcessWithContainersSchema = ProcessSchema.extend({
  containers: z.array(ProcessContainerSchema),
})
export type ProcessWithContainers = z.infer<typeof ProcessWithContainersSchema>

/**
 * Container number validation (ISO 6346)
 * Format: 4 letters + 7 digits (soft validation, we allow creation but show warning)
 */
export function validateContainerNumber(containerNumber: string): {
  valid: boolean
  message?: string
} {
  const normalized = containerNumber.toUpperCase().trim()

  if (normalized.length === 0) {
    return { valid: false, message: 'Container number is required' }
  }

  // ISO 6346: 4 letters + 7 digits = 11 characters
  const iso6346Regex = /^[A-Z]{4}[0-9]{7}$/
  if (!iso6346Regex.test(normalized)) {
    return {
      valid: true, // Still allow creation
      message: `Container number may be invalid. Expected format: 4 letters + 7 digits (e.g., MSCU1234567)`,
    }
  }

  return { valid: true }
}

/**
 * Check for duplicate container numbers in a list
 */
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

/**
 * Factory function to create a new Process entity
 */
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
