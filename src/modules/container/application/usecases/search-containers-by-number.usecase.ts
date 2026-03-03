import type { ContainerSearchProjection } from '~/modules/container/application/container.readmodels'
import type { ContainerRepository } from '~/modules/container/application/container.repository'

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function containsMatch(containerNumber: string, normalizedQuery: string): boolean {
  return normalizeText(containerNumber).includes(normalizedQuery)
}

function toSearchProjection(container: {
  readonly processId: string
  readonly containerNumber: string
}): ContainerSearchProjection {
  return {
    processId: container.processId,
    containerNumber: container.containerNumber,
  }
}

function selectProcessIdsWithinLimit(
  matches: readonly {
    readonly processId: string
  }[],
  limit: number,
): ReadonlySet<string> {
  const selectedProcessIds = new Set<string>()

  for (const match of matches) {
    if (selectedProcessIds.has(match.processId)) {
      continue
    }
    if (selectedProcessIds.size >= limit) {
      break
    }

    selectedProcessIds.add(match.processId)
  }

  return selectedProcessIds
}

export function createSearchContainersByNumberUseCase(deps: {
  readonly repository: ContainerRepository
}) {
  return async function searchByNumber(
    query: string,
    limit: number,
  ): Promise<readonly ContainerSearchProjection[]> {
    const normalizedQuery = normalizeText(query)
    if (normalizedQuery.length === 0 || limit <= 0) {
      return []
    }

    const containers = await deps.repository.listSearchProjections()

    const matches = containers.filter((container) =>
      containsMatch(container.containerNumber, normalizedQuery),
    )

    const selectedProcessIds = selectProcessIdsWithinLimit(matches, limit)
    const limitedMatches = matches.filter((container) =>
      selectedProcessIds.has(container.processId),
    )

    return limitedMatches.map((container) =>
      toSearchProjection({
        processId: container.processId,
        containerNumber: container.containerNumber,
      }),
    )
  }
}
