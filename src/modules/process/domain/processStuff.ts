import { z } from 'zod'
import type { Container, NewContainer } from '~/modules/container/domain/container'
import { type NewProcess, type Process, ProcessSchema } from '~/modules/process/domain/process'
import {
  Carrier,
  CarrierSchema,
  ContainerInitialStatus,
  ProcessSourceSchema,
} from '~/modules/process/domain/value-objects'

export const ProcessContainerSchema = z.object({
  id: z.string().uuid(),
  process_id: z.string().uuid(),
  container_number: z
    .string()
    .min(1)
    .transform((v) => v.toUpperCase().trim()),
  carrier_code: z.string().nullable().optional(),
  created_at: z.date(),
  removed_at: z.date().nullable().optional(),
})
export type ProcessContainer = z.infer<typeof ProcessContainerSchema>

/**
 * Schema for creating a new process (input from UI)
 */
export const CreateProcessInputSchema = z.object({
  reference: z.string().nullable().optional(),
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
  carrier: CarrierSchema,
  bill_of_lading: z.string().nullable().optional(),
  booking_number: z.string().nullable().optional(),
  importer_name: z.string().nullable().optional(),
  exporter_name: z.string().nullable().optional(),
  reference_importer: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  redestination_number: z.string().nullable().optional(),
  containers: z
    .array(
      z.object({
        container_number: z.string().min(1),
        carrier_code: z.string(),
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
export function createProcess(input: CreateProcessInput): NewProcess {
  const process: NewProcess = {
    reference: input.reference,
    origin: input.origin?.display_name ? { display_name: input.origin.display_name } : null,
    destination: input.destination?.display_name
      ? { display_name: input.destination.display_name }
      : null,
    carrier: input.carrier,
    bill_of_lading: input.bill_of_lading,
    booking_number: input.booking_number,
    importer_name: input.importer_name,
    exporter_name: input.exporter_name,
    reference_importer: input.reference_importer,
    product: input.product,
    redestination_number: input.redestination_number,
    source: 'manual',
  } satisfies NewProcess

  return process
}
