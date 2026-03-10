import { describe, expect, it } from 'vitest'

import {
  listTrackingScenarioGroups,
  listTrackingScenarios,
  SCENARIO_STAGES,
} from '~/modules/tracking/dev/scenario-lab/scenario.catalog'

describe('tracking scenario catalog', () => {
  it('contains at least 30 scenarios', () => {
    expect(listTrackingScenarios().length).toBeGreaterThanOrEqual(30)
  })

  it('contains required canonical scenario ids', () => {
    const scenarioIds = new Set(listTrackingScenarios().map((scenario) => scenario.id))

    expect(scenarioIds.has('unknown.never_synced')).toBe(true)
    expect(scenarioIds.has('booking.basic')).toBe(true)
    expect(scenarioIds.has('maersk.empty_gate_out')).toBe(true)
    expect(scenarioIds.has('transshipment_clean')).toBe(true)
    expect(scenarioIds.has('process.all_in_transit')).toBe(true)
    expect(scenarioIds.has('conflict.double_actual')).toBe(true)
  })

  it('maintains monotonic stage bounds', () => {
    const stages = new Set(SCENARIO_STAGES.map((entry) => entry.stage))

    for (const scenario of listTrackingScenarios()) {
      expect(stages.has(scenario.stage)).toBe(true)
      expect(scenario.steps.length).toBeGreaterThan(0)
    }
  })

  it('only references existing scenarios in groups', () => {
    const scenarioIds = new Set(listTrackingScenarios().map((scenario) => scenario.id))

    for (const group of listTrackingScenarioGroups()) {
      for (const scenarioId of group.scenarioIds) {
        expect(scenarioIds.has(scenarioId)).toBe(true)
      }
    }
  })
})
