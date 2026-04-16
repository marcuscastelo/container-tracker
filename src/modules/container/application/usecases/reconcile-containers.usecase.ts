import type { ContainerRepository } from '~/modules/container/application/container.repository'
import {
  normalizeContainerNumber,
  validateContainerWithWarnings,
} from '~/modules/container/domain/container.validation'
import {
  CannotRemoveLastContainerError,
  DuplicateContainersError,
} from '~/shared/errors/container-process.errors'

type ReconcileContainersCommand = {
  processId: string
  existing: {
    id: string
    containerNumber: string
    carrierCode?: string | null
  }[]
  incoming: {
    containerNumber: string
    carrierCode?: string | null
  }[]
}

type ReconcileContainersResult = {
  added: {
    id: string
    containerNumber: string
    carrierCode: string
  }[]
  updated: {
    id: string
    containerNumber: string
    carrierCode: string
  }[]
  removed: string[] // container IDs
  warnings: string[]
}

function normalizeCarrierCodeForComparison(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.trim().toLowerCase()
}

export function createReconcileContainersUseCase(deps: { repository: ContainerRepository }) {
  return async function execute(
    command: ReconcileContainersCommand,
  ): Promise<ReconcileContainersResult> {
    const warnings: string[] = []
    const added = []
    const updated = []
    const removed: string[] = []

    const normalizedIncoming = command.incoming.map((i) => {
      const normalized = normalizeContainerNumber(i.containerNumber)
      warnings.push(...validateContainerWithWarnings(normalized))
      return {
        containerNumber: normalized,
        carrierCode: i.carrierCode ?? '',
      }
    })

    const seen = new Set<string>()
    for (const i of normalizedIncoming) {
      if (seen.has(i.containerNumber)) {
        throw new DuplicateContainersError([i.containerNumber])
      }
      seen.add(i.containerNumber)
    }

    const existingByNumber = new Map(
      command.existing.map((c) => [normalizeContainerNumber(c.containerNumber), c]),
    )

    const incomingNumbers = new Set(normalizedIncoming.map((c) => c.containerNumber))

    // ADD
    for (const inc of normalizedIncoming) {
      const existing = existingByNumber.get(inc.containerNumber)

      if (!existing) {
        const container = await deps.repository.insert({
          processId: command.processId,
          containerNumber: inc.containerNumber,
          carrierCode: inc.carrierCode,
        })

        added.push(container)
        continue
      }

      if (
        normalizeCarrierCodeForComparison(existing.carrierCode) !==
        normalizeCarrierCodeForComparison(inc.carrierCode)
      ) {
        const container = await deps.repository.update({
          id: existing.id,
          containerNumber: inc.containerNumber,
          carrierCode: inc.carrierCode,
        })

        updated.push(container)
      }
    }

    // REMOVE
    const toRemove = command.existing.filter(
      (ex) => !incomingNumbers.has(normalizeContainerNumber(ex.containerNumber)),
    )

    for (const container of toRemove) {
      const currentCount = command.existing.length - removed.length
      if (currentCount <= 1) {
        throw new CannotRemoveLastContainerError(command.processId, container.id)
      }

      await deps.repository.delete(container.id)

      removed.push(container.id)
    }

    return { added, updated, removed, warnings }
  }
}
