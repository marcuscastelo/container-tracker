import {
  buildScenario,
  buildScenarioContainerInputs,
  buildScenarioContainerNumbers,
  buildScenarioProcessReference,
  buildScenarioProviderByContainerKey,
  generateScenarioRunToken,
} from '~/modules/tracking/dev/scenario-lab/scenario.builder'
import {
  listTrackingScenarioGroups,
  listTrackingScenarioSummaries,
  listTrackingScenarios,
  SCENARIO_STAGES,
} from '~/modules/tracking/dev/scenario-lab/scenario.catalog'
import type {
  ScenarioLoadCommand,
  ScenarioSeedResult,
  TrackingScenario,
} from '~/modules/tracking/dev/scenario-lab/scenario.types'
import type { Provider } from '~/modules/tracking/domain/model/provider'

type ProcessInsertRecord = Readonly<{
  reference: string | null
  origin?: string | null
  destination?: string | null
  carrier: string
  bill_of_lading: string | null
  booking_number: string | null
  importer_name: string | null
  exporter_name: string | null
  reference_importer: string | null
  product?: string | null
  redestination_number?: string | null
  source: string
}>

type ScenarioContainerInput = Readonly<{
  container_number: string
  carrier_code: string | null
}>

type CreatedProcessContainer = Readonly<{
  id: string
  containerNumber: string
}>

type CreatedProcess = Readonly<{
  id: string
}>

type CreateProcessResult = Readonly<{
  process: CreatedProcess
  containers: readonly CreatedProcessContainer[]
}>

type ScenarioSeedDeps = Readonly<{
  createProcess: (command: {
    record: ProcessInsertRecord
    containers: readonly ScenarioContainerInput[]
  }) => Promise<CreateProcessResult>
  saveAndProcess: (command: {
    containerId: string
    containerNumber: string
    provider: Provider
    payload: unknown
    fetchedAt: string
  }) => Promise<void>
}>

type ScenarioCatalogResponse = Readonly<{
  stages: typeof SCENARIO_STAGES
  groups: ReturnType<typeof listTrackingScenarioGroups>
  scenarios: ReturnType<typeof listTrackingScenarioSummaries>
}>

function normalizeContainerNumber(value: string): string {
  return value.trim().toUpperCase()
}

function firstContainerProviderOrDefault(scenario: TrackingScenario): Provider {
  const firstContainer = scenario.containers[0]
  if (firstContainer) return firstContainer.provider
  return 'maersk'
}

function buildProcessInsertRecord(params: {
  scenario: TrackingScenario
  processReference: string
  runToken: string
}): ProcessInsertRecord {
  const normalizedToken = params.runToken.toUpperCase()
  const firstProvider = firstContainerProviderOrDefault(params.scenario)

  return {
    reference: params.processReference,
    origin: 'Scenario Lab Origin',
    destination: 'Scenario Lab Destination',
    carrier: firstProvider,
    bill_of_lading: `LAB-BL-${normalizedToken}`,
    booking_number: `LAB-BK-${normalizedToken}`,
    importer_name: 'Tracking Scenario Lab',
    exporter_name: 'Tracking Scenario Lab',
    reference_importer: params.scenario.id,
    product: params.scenario.title,
    redestination_number: null,
    source: 'scenario_lab',
  }
}

function resolveContainerIdsByKey(params: {
  scenario: TrackingScenario
  createdContainers: readonly CreatedProcessContainer[]
  containerNumbersByKey: ReadonlyMap<string, string>
}): ReadonlyMap<string, string> {
  const containerIdByKey = new Map<string, string>()
  const containerIdByNumber = new Map<string, string>()

  for (const container of params.createdContainers) {
    containerIdByNumber.set(normalizeContainerNumber(container.containerNumber), container.id)
  }

  for (const scenarioContainer of params.scenario.containers) {
    const number = params.containerNumbersByKey.get(scenarioContainer.key)
    if (!number) {
      throw new Error(
        `Missing generated number for scenario container key: ${scenarioContainer.key}`,
      )
    }

    const containerId = containerIdByNumber.get(normalizeContainerNumber(number))
    if (!containerId) {
      throw new Error(`Created process is missing container for generated number: ${number}`)
    }

    containerIdByKey.set(scenarioContainer.key, containerId)
  }

  return containerIdByKey
}

export function createScenarioSeeder(deps: ScenarioSeedDeps) {
  async function loadScenario(command: ScenarioLoadCommand): Promise<ScenarioSeedResult> {
    const runToken = generateScenarioRunToken()
    const buildResult = buildScenario({ command, runToken })

    const containerNumbersByKey = buildScenarioContainerNumbers({
      scenario: buildResult.scenario,
      appliedStep: buildResult.appliedStep,
      runToken,
    })

    const processReference = buildScenarioProcessReference(
      buildResult.scenario.id,
      buildResult.appliedStep,
      runToken,
    )

    const createProcessResult = await deps.createProcess({
      record: buildProcessInsertRecord({
        scenario: buildResult.scenario,
        processReference,
        runToken,
      }),
      containers: buildScenarioContainerInputs({
        scenario: buildResult.scenario,
        containerNumbersByKey,
      }),
    })

    const containerIdsByKey = resolveContainerIdsByKey({
      scenario: buildResult.scenario,
      createdContainers: createProcessResult.containers,
      containerNumbersByKey,
    })

    const providerByContainerKey = buildScenarioProviderByContainerKey(buildResult.scenario)

    for (const snapshot of buildResult.snapshots) {
      const containerId = containerIdsByKey.get(snapshot.containerKey)
      if (!containerId) {
        throw new Error(
          `Missing container id for snapshot key ${snapshot.containerKey} in scenario ${buildResult.scenario.id}`,
        )
      }

      const containerNumber = containerNumbersByKey.get(snapshot.containerKey)
      if (!containerNumber) {
        throw new Error(
          `Missing container number for snapshot key ${snapshot.containerKey} in scenario ${buildResult.scenario.id}`,
        )
      }

      const provider = providerByContainerKey.get(snapshot.containerKey) ?? snapshot.provider

      await deps.saveAndProcess({
        containerId,
        containerNumber,
        provider,
        payload: snapshot.payload,
        fetchedAt: snapshot.fetchedAt,
      })
    }

    return {
      scenarioId: buildResult.scenario.id,
      appliedStep: buildResult.appliedStep,
      processId: createProcessResult.process.id,
      processReference,
      stage: buildResult.scenario.stage,
      containerIds: createProcessResult.containers.map((container) => container.id),
      containerNumbers: buildResult.scenario.containers.map((container) => {
        const value = containerNumbersByKey.get(container.key)
        if (!value) {
          throw new Error(`Missing generated number for container ${container.key}`)
        }
        return value
      }),
      totalSnapshotsApplied: buildResult.snapshots.length,
    }
  }

  function getCatalog(): ScenarioCatalogResponse {
    return {
      stages: SCENARIO_STAGES,
      groups: listTrackingScenarioGroups(),
      scenarios: listTrackingScenarioSummaries(),
    }
  }

  function getScenarioCount(): number {
    return listTrackingScenarios().length
  }

  return {
    loadScenario,
    getCatalog,
    getScenarioCount,
  }
}
