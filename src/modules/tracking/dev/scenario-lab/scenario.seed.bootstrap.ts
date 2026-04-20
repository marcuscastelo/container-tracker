import { processUseCases } from '~/modules/process/infrastructure/bootstrap/process.bootstrap'
import { createScenarioSeeder } from '~/modules/tracking/dev/scenario-lab/scenario.seed'
import { bootstrapTrackingModule } from '~/modules/tracking/infrastructure/bootstrap/tracking.bootstrap'

const { trackingUseCases } = bootstrapTrackingModule()

export const scenarioSeeder = createScenarioSeeder({
  async createProcess({ record, containers }) {
    const result = await processUseCases.createProcess({
      record,
      containers,
    })

    return {
      process: {
        id: result.process.id,
        reference: result.process.reference,
      },
      containers: result.containers.map((container) => ({
        id: String(container.id),
        containerNumber: String(container.containerNumber),
      })),
    }
  },

  async findProcessByIdWithContainers({ processId }) {
    const result = await processUseCases.findProcessByIdWithContainers({ processId })
    if (result.process === null) {
      return {
        process: null,
        containers: [],
      }
    }

    return {
      process: {
        id: result.process.process.id,
        reference: result.process.process.reference,
      },
      containers: result.process.containers.map((container) => ({
        id: String(container.id),
        containerNumber: String(container.containerNumber),
      })),
    }
  },

  async saveAndProcess({ containerId, containerNumber, provider, payload, fetchedAt }) {
    await trackingUseCases.saveAndProcess(
      containerId,
      containerNumber,
      provider,
      payload,
      null,
      fetchedAt,
    )
  },
})
