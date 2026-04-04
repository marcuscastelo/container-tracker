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
            reference: command.record.reference,
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
      findProcessByIdWithContainers: async () => ({
        process: null,
        containers: [],
      }),
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
    expect(result.reusedExistingProcess).toBe(false)
    expect(result.totalSnapshotsApplied).toBe(2)
  })

  it('throws when scenario id is invalid', async () => {
    const seeder = createScenarioSeeder({
      createProcess: async () => ({
        process: { id: 'process-ignored', reference: 'process-ignored' },
        containers: [],
      }),
      findProcessByIdWithContainers: async () => ({
        process: null,
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

  it('reuses an existing process and preserves container identity for later steps', async () => {
    const createProcess = vi.fn(async () => {
      throw new Error('createProcess should not run during reuse')
    })
    const saveAndProcess = vi.fn(async () => {})

    const seeder = createScenarioSeeder({
      createProcess,
      findProcessByIdWithContainers: async () => ({
        process: {
          id: 'process-lab-reused',
          reference: 'LAB-REUSED-1',
        },
        containers: [
          {
            id: 'container-reused-1',
            containerNumber: 'MAEU1234567',
          },
        ],
      }),
      saveAndProcess,
    })

    const result = await seeder.loadScenario({
      scenarioId: 'post_carriage_maritime_inconsistent',
      step: 3,
      reuseProcessId: 'process-lab-reused',
    })

    expect(createProcess).not.toHaveBeenCalled()
    expect(saveAndProcess).toHaveBeenCalledTimes(3)
    expect(result.processId).toBe('process-lab-reused')
    expect(result.processReference).toBe('LAB-REUSED-1')
    expect(result.reusedExistingProcess).toBe(true)
    expect(result.containerNumbers).toEqual(['MAEU1234567'])
  })
})
