// src/modules/process/process.bootstrap.ts
//
// Composition root for the Process module.
// Wires repositories + cross-module UseCases, and exports ProcessUseCases.
// No business logic here.

import {
  type ContainerUseCases,
  createContainerUseCases,
} from '~/modules/container/application/container.usecases'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'
import type { ContainerUseCasesForProcess } from '~/modules/process/application/process.container-usecases'
import type { ProcessContainerRecord } from '~/modules/process/application/process.readmodels'
import { createProcessUseCases } from '~/modules/process/application/process.usecases'
import { supabaseProcessRepository } from '~/modules/process/infrastructure/persistence/supabaseProcessRepository'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

function toProcessContainerRecord(command: {
  readonly id: string
  readonly processId: string
  readonly containerNumber: string
  readonly carrierCode: string | null
}): ProcessContainerRecord {
  return {
    id: command.id,
    processId: command.processId,
    containerNumber: command.containerNumber,
    carrierCode: command.carrierCode,
  }
}

function pickContainerUseCasesForProcess(all: ContainerUseCases): ContainerUseCasesForProcess {
  return {
    checkExistence: all.checkExistence,
    createManyForProcess: all.createManyForProcess,
    reconcileForProcess: all.reconcileForProcess,
    deleteContainer: all.deleteContainer,
    findByNumbers: all.findByNumbers,
    listByProcessId: async (command) => {
      const result = await all.listByProcessId(command)

      return {
        containers: result.containers.map((container) =>
          toProcessContainerRecord({
            id: String(container.id),
            processId: String(container.processId),
            containerNumber: String(container.containerNumber),
            carrierCode: container.carrierCode === null ? null : String(container.carrierCode),
          }),
        ),
      }
    },
    listByProcessIds: async (command) => {
      const result = await all.listByProcessIds(command)
      const containersByProcessId = new Map<string, readonly ProcessContainerRecord[]>()

      for (const [processId, containers] of result.containersByProcessId.entries()) {
        containersByProcessId.set(
          processId,
          containers.map((container) =>
            toProcessContainerRecord({
              id: String(container.id),
              processId: String(container.processId),
              containerNumber: String(container.containerNumber),
              carrierCode: container.carrierCode === null ? null : String(container.carrierCode),
            }),
          ),
        )
      }

      return { containersByProcessId }
    },
  }
}

// Container module wiring (owned by container module)
const containerUseCases = createContainerUseCases({ repository: supabaseContainerRepository })

// Restrict dependency surface: Process only sees what it needs from Container
const containerDepsForProcess = pickContainerUseCasesForProcess(containerUseCases)

// Tracking module wiring (for operational summary aggregation)
const { trackingUseCases } = bootstrapTrackingModule()

export const processUseCases = createProcessUseCases({
  repository: supabaseProcessRepository,
  containerUseCases: containerDepsForProcess,
  trackingUseCases,
})
