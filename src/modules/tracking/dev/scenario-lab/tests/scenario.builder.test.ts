import { describe, expect, it } from 'vitest'

import {
  buildScenario,
  buildScenarioContainerNumbers,
} from '~/modules/tracking/dev/scenario-lab/scenario.builder'

describe('scenario builder', () => {
  it('builds cumulative snapshots until selected step', () => {
    const runToken = 'labrun01'

    const result = buildScenario({
      command: {
        scenarioId: 'in_transit_eta_predictions',
        step: 3,
      },
      runToken,
    })

    expect(result.appliedStep).toBe(3)
    expect(result.snapshots.length).toBe(3)
  })

  it('clamps step to scenario max step', () => {
    const result = buildScenario({
      command: {
        scenarioId: 'gate_in_basic',
        step: 99,
      },
      runToken: 'labrun02',
    })

    expect(result.appliedStep).toBe(2)
    expect(result.snapshots.length).toBe(2)
  })

  it('generates deterministic container numbers for same run token', () => {
    const scenarioResult = buildScenario({
      command: {
        scenarioId: 'process.all_in_transit',
        step: 1,
      },
      runToken: 'fixedtoken',
    })

    const first = buildScenarioContainerNumbers({
      scenario: scenarioResult.scenario,
      appliedStep: scenarioResult.appliedStep,
      runToken: 'fixedtoken',
    })

    const second = buildScenarioContainerNumbers({
      scenario: scenarioResult.scenario,
      appliedStep: scenarioResult.appliedStep,
      runToken: 'fixedtoken',
    })

    expect([...first.entries()]).toEqual([...second.entries()])
  })
})
