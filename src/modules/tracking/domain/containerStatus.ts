import z from 'zod/v4'

/**
 * Canonical container tracking status — monotonic projection.
 *
 * Status is derived from the timeline and NEVER regresses.
 * The order here reflects semantic dominance (higher index = more advanced).
 *
 * @see docs/master-consolidated-0209.md §2.6, §4.3
 */
export const ContainerStatusSchema = z.enum([
  /** No data yet */
  'UNKNOWN',
  /** Container exists, minimal info */
  'IN_PROGRESS',
  /** Container loaded on vessel */
  'LOADED',
  /** Vessel departed (container in transit) */
  'IN_TRANSIT',
  /** Arrived at port of discharge */
  'ARRIVED_AT_POD',
  /** Discharged from vessel at final port */
  'DISCHARGED',
  /** Available for pickup at terminal */
  'AVAILABLE_FOR_PICKUP',
  /** Delivered to consignee */
  'DELIVERED',
  /** Empty container returned to depot */
  'EMPTY_RETURNED',
])

export type ContainerStatus = z.infer<typeof ContainerStatusSchema>

/**
 * Dominance order — higher index means more advanced.
 * Used by deriveStatus to ensure monotonicity.
 */
export const STATUS_DOMINANCE: readonly ContainerStatus[] = [
  'UNKNOWN',
  'IN_PROGRESS',
  'LOADED',
  'IN_TRANSIT',
  'ARRIVED_AT_POD',
  'DISCHARGED',
  'AVAILABLE_FOR_PICKUP',
  'DELIVERED',
  'EMPTY_RETURNED',
] as const

/**
 * Returns the dominance index of a status (higher = more advanced).
 */
export function statusDominanceIndex(status: ContainerStatus): number {
  const idx = STATUS_DOMINANCE.indexOf(status)
  return idx >= 0 ? idx : 0
}
