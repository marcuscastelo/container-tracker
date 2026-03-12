import { describe, expect, it, vi } from 'vitest'

import { createScenarioSeeder } from '~/modules/tracking/dev/scenario-lab/scenario.seed'

describe('scenario seeder', () => {
  it('creates process and applies snapshots through real pipeline contract', async () => {
    const createProcess = vi.fn(
      async (command: {
        record: { reference: string | null }
        containers: readonly { container_number: string; carrier_code: string | null }[]
      }) => {
        return {
          process: {
            id: 'process-lab-1',
          },
          containers: command.containers.map((container, index) => ({
            id: `container-${index + 1}`,
            containerNumber: container.container_number,
          })),
        }
      },
    )

    const saveAndProcess = vi.fn(async () => {})

    const seeder = createScenarioSeeder({
      createProcess,
      saveAndProcess,
    })

    const result = await seeder.loadScenario({
      scenarioId: 'gate_in_basic',
      step: 2,
    })

    expect(createProcess).toHaveBeenCalledTimes(1)
    expect(saveAndProcess).toHaveBeenCalledTimes(2)
    expect(result.processId).toBe('process-lab-1')
    expect(result.appliedStep).toBe(2)
    expect(result.totalSnapshotsApplied).toBe(2)
  })

  it('throws when scenario id is invalid', async () => {
    const seeder = createScenarioSeeder({
      createProcess: async () => ({
        process: { id: 'process-ignored' },
        containers: [],
      }),
      saveAndProcess: async () => {},
    })

    await expect(
      seeder.loadScenario({
        scenarioId: 'not.exists',
        step: 1,
      }),
    ).rejects.toThrow('Scenario not found')
  })
})
