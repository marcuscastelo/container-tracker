import type { ContainerStatus } from './ContainerStatus'

export type DerivedContainerState = {
  container_number: string
  status: ContainerStatus
  last_event?: Record<string, unknown> // point to CanonicalEvent when ready
  derived_at: string // ISO
}
