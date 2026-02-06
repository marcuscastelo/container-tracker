import type { DerivedContainerState } from '../domain/DerivedContainerState'

export function deriveProcessSummary(states: DerivedContainerState[]) {
  // placeholder: aggregate containers into a simple summary
  return {
    totalContainers: states.length,
    byStatus: states.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {}),
  }
}
