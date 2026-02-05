import { z } from 'zod'
import { type Process, ProcessSchema } from '~/modules/process/domain/process'
import {
  Carrier,
  ContainerInitialStatus,
  OperationType,
  ProcessSource,
} from '~/modules/process/domain/value-objects'

export const ProcessContainerSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  container_number: z
    .string()
    .min(1)
    .transform((v) => v.toUpperCase().trim()),
  carrier_code: z.string().nullable().optional(),
  container_type: z.string().nullable().optional(), // e.g., "40HC", "20GP"
  container_size: z.string().nullable().optional(),
  created_at: z.date(),
  removed_at: z.date().nullable().optional(),
})
export type ProcessContainer = z.infer<typeof ProcessContainerSchema>

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
  bill_of_lading: z.string().nullable().optional(),
  containers: z
    .array(
      z.object({
        container_number: z.string().min(1),
        carrier_code: z.string().nullable().optional(),
        container_type: z.string().nullable().optional(),
        container_size: z.string().nullable().optional(),
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
    bill_of_lading: input.bill_of_lading ?? null,
    booking_reference: null,
    source: 'manual',
  }

  const containers = input.containers.map((c) => ({
    container_number: c.container_number.toUpperCase().trim(),
    carrier_code: c.carrier_code ?? null,
    container_type: c.container_type ?? null,
    container_size: c.container_size ?? null,
  }))

  return { process, containers }
}
