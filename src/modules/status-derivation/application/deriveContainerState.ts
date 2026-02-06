import { ContainerStatus } from '../domain/ContainerStatus'
import type { DerivedContainerState } from '../domain/DerivedContainerState'

/**
 * Lightweight derivation: look at last event and pick a status.
 * Replace heuristics with domain rules later.
 */
export function deriveContainerState(events: Record<string, unknown>[]): DerivedContainerState {
  const last = events.length ? events[events.length - 1] : undefined
  // naive mapping: prefer explicit type, else unknown
  const type = (last && (last.type as string)) ?? 'UNKNOWN'
  let status = ContainerStatus.UNKNOWN
  if (type.includes('DELIVER')) status = ContainerStatus.DELIVERED
  else if (type.includes('GATE_IN')) status = ContainerStatus.GATE_IN
  else if (type.includes('GATE_OUT')) status = ContainerStatus.GATE_OUT
  else if (type.includes('LOAD') || type.includes('DISCHARGE')) status = ContainerStatus.IN_TRANSIT

  return {
    container_number: String(last?.container_number ?? 'unknown'),
    status,
    last_event: last ?? undefined,
    derived_at: new Date().toISOString(),
  }
}
