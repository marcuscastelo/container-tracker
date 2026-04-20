import type { Provider } from '~/modules/tracking/domain/model/provider'

export type ScenarioStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type ScenarioCategory = 'lifecycle' | 'data_pathologies' | 'process_aggregation'

export type ScenarioContainerTemplate = Readonly<{
  key: string
  label: string
  provider: Provider
}>

export type ScenarioEventTimeType = 'ACTUAL' | 'EXPECTED'

export type ScenarioMaerskEventSpec = Readonly<{
  activity: string
  eventTime: string
  eventTimeType: ScenarioEventTimeType
  locationCode: string
  locationCity: string
  locationCountryCode: string
  vesselName?: string | null
  voyage?: string | null
  isEmpty?: boolean | null
}>

export type ScenarioMscEventSpec = Readonly<{
  description: string
  eventTime: string
  locationCode: string
  locationDisplay: string
  vesselName?: string | null
  voyage?: string | null
  detail?: readonly string[]
}>

export type ScenarioCmaMoveSpec = Readonly<{
  statusDescription: string
  eventTime: string
  locationCode: string
  locationDisplay: string
  state?: 'DONE' | 'CURRENT' | 'NONE'
  vesselName?: string | null
  voyage?: string | null
}>

export type ScenarioSnapshotBlueprint =
  | Readonly<{
      kind: 'maersk'
      containerKey: string
      fetchedAt: string
      events: readonly ScenarioMaerskEventSpec[]
    }>
  | Readonly<{
      kind: 'msc'
      containerKey: string
      fetchedAt: string
      currentDate: string
      events: readonly ScenarioMscEventSpec[]
      podEtaDate?: string | null
      podLocation?: string | null
    }>
  | Readonly<{
      kind: 'cmacgm'
      containerKey: string
      fetchedAt: string
      moves: readonly ScenarioCmaMoveSpec[]
      estimatedTimeOfArrival?: string | null
      placeOfLoading?: string | null
      lastDischargePort?: string | null
    }>

export type ScenarioStep = Readonly<{
  id: string
  title: string
  description: string
  snapshots: readonly ScenarioSnapshotBlueprint[]
}>

export type TrackingScenario = Readonly<{
  id: string
  title: string
  description: string
  category: ScenarioCategory
  stage: ScenarioStage
  tags: readonly string[]
  containers: readonly ScenarioContainerTemplate[]
  steps: readonly ScenarioStep[]
}>

export type ScenarioCatalogGroup = Readonly<{
  id: string
  title: string
  description: string
  stage: ScenarioStage | null
  scenarioIds: readonly string[]
}>

export type ScenarioCatalog = Readonly<{
  scenarios: readonly TrackingScenario[]
  groups: readonly ScenarioCatalogGroup[]
}>

export type TrackingScenarioSummary = Readonly<{
  id: string
  title: string
  description: string
  category: ScenarioCategory
  stage: ScenarioStage
  tags: readonly string[]
  stepsCount: number
  containersCount: number
}>

export type ScenarioLoadCommand = Readonly<{
  scenarioId: string
  step: number
  reuseProcessId?: string
}>

export type ScenarioStepSnapshot = Readonly<{
  containerKey: string
  provider: Provider
  fetchedAt: string
  payload: unknown
}>

export type ScenarioBuildResult = Readonly<{
  scenario: TrackingScenario
  appliedStep: number
  containerNumbersByKey: ReadonlyMap<string, string>
  snapshots: readonly ScenarioStepSnapshot[]
}>

export type ScenarioSeedResult = Readonly<{
  scenarioId: string
  appliedStep: number
  processId: string
  processReference: string
  reusedExistingProcess: boolean
  stage: ScenarioStage
  containerIds: readonly string[]
  containerNumbers: readonly string[]
  totalSnapshotsApplied: number
}>

export type ScenarioStageDefinition = Readonly<{
  stage: ScenarioStage
  label: string
  title: string
}>
