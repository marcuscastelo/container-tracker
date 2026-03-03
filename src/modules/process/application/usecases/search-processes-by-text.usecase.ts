import type { ProcessSearchProjection } from '~/modules/process/application/process.readmodels'
import type { ProcessRepository } from '~/modules/process/application/process.repository'

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

function containsMatch(value: string | null, normalizedQuery: string): boolean {
  return value !== null && normalizeText(value).includes(normalizedQuery)
}

function toSearchProjection(process: {
  readonly id: string
  readonly reference: string | null
  readonly importerName: string | null
  readonly billOfLading: string | null
  readonly carrier: string | null
}): ProcessSearchProjection {
  return {
    processId: process.id,
    reference: process.reference,
    importerName: process.importerName,
    billOfLading: process.billOfLading,
    carrier: process.carrier,
  }
}

export function createSearchProcessesByTextUseCase(deps: {
  readonly repository: ProcessRepository
}) {
  return async function searchByText(
    query: string,
    limit: number,
  ): Promise<readonly ProcessSearchProjection[]> {
    const normalizedQuery = normalizeText(query)
    if (normalizedQuery.length === 0 || limit <= 0) {
      return []
    }

    const processes = await deps.repository.fetchAll()

    const matches = processes.filter((process) => {
      return (
        containsMatch(process.reference, normalizedQuery) ||
        containsMatch(process.importerName, normalizedQuery) ||
        containsMatch(process.billOfLading, normalizedQuery) ||
        containsMatch(process.carrier, normalizedQuery)
      )
    })

    return matches.slice(0, limit).map((process) =>
      toSearchProjection({
        id: process.id,
        reference: process.reference,
        importerName: process.importerName,
        billOfLading: process.billOfLading,
        carrier: process.carrier,
      }),
    )
  }
}
