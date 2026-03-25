import { getTrackingScenarioById } from '~/modules/tracking/dev/scenario-lab/scenario.catalog'
import type {
  ScenarioBuildResult,
  ScenarioCmaMoveSpec,
  ScenarioLoadCommand,
  ScenarioMaerskEventSpec,
  ScenarioMscEventSpec,
  ScenarioSnapshotBlueprint,
  ScenarioStepSnapshot,
  TrackingScenario,
} from '~/modules/tracking/dev/scenario-lab/scenario.types'
import type { Provider } from '~/modules/tracking/domain/model/provider'

type ContainerNumbersByKey = ReadonlyMap<string, string>

const CMACGM_CONTAINER_STATUS_IN_TRANSIT = 51

function providerFromBlueprint(snapshot: ScenarioSnapshotBlueprint): Provider {
  if (snapshot.kind === 'maersk') return 'maersk'
  if (snapshot.kind === 'msc') return 'msc'
  return 'cmacgm'
}

function providerToCarrierCode(provider: Provider): string {
  if (provider === 'maersk') return 'MAEU'
  if (provider === 'msc') return 'MSCU'
  return 'CMAU'
}

function providerToContainerPrefix(provider: Provider): string {
  if (provider === 'maersk') return 'MAEU'
  if (provider === 'msc') return 'MSCU'
  return 'CMAU'
}

function normalizeReferenceToken(input: string): string {
  return input
    .replace(/[^a-z0-9]/giu, '')
    .toUpperCase()
    .slice(0, 24)
}

function hashString(input: string): number {
  let hash = 5381
  for (let index = 0; index < input.length; index++) {
    const codePoint = input.codePointAt(index)
    if (codePoint === undefined) continue
    hash = ((hash << 5) + hash) ^ codePoint
  }

  return Math.abs(hash)
}

function toMscDate(iso: string): string {
  const date = new Date(iso)
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const year = String(date.getUTCFullYear())
  return `${day}/${month}/${year}`
}

function toCmaMsDate(iso: string): string {
  const date = new Date(iso)
  return `/Date(${date.getTime()})/`
}

function toLatestMaerskEventTime(events: readonly ScenarioMaerskEventSpec[]): string | null {
  if (events.length === 0) return null

  let latest: string | null = null
  for (const event of events) {
    if (latest === null || event.eventTime > latest) {
      latest = event.eventTime
    }
  }

  return latest
}

function buildMaerskPayload(
  containerNumber: string,
  events: readonly ScenarioMaerskEventSpec[],
): unknown {
  const byLocation = new Map<
    string,
    {
      city: string
      countryCode: string
      events: {
        type: string
        activity: string
        event_time: string
        event_time_type: 'ACTUAL' | 'EXPECTED'
        locationCode: string
        stempty: boolean | null
        vessel_name: string | null
        voyage_num: string | null
      }[]
    }
  >()

  for (const event of events) {
    const existing = byLocation.get(event.locationCode)
    const mappedEvent = {
      type: 'EQUIPMENT',
      activity: event.activity,
      event_time: event.eventTime,
      event_time_type: event.eventTimeType,
      locationCode: event.locationCode,
      stempty: event.isEmpty ?? null,
      vessel_name: event.vesselName ?? null,
      voyage_num: event.voyage ?? null,
    }

    if (existing) {
      existing.events.push(mappedEvent)
      continue
    }

    byLocation.set(event.locationCode, {
      city: event.locationCity,
      countryCode: event.locationCountryCode,
      events: [mappedEvent],
    })
  }

  const locations = [...byLocation.entries()].map(([code, location]) => ({
    city: location.city,
    country_code: location.countryCode,
    location_code: code,
    events: location.events,
  }))

  const latestEventTime = toLatestMaerskEventTime(events)

  return {
    containers: [
      {
        status: 'IN_PROGRESS',
        operator: providerToCarrierCode('maersk'),
        container_num: containerNumber,
        last_update_time: latestEventTime,
        locations,
      },
    ],
  }
}

function buildMscDetail(event: ScenarioMscEventSpec): readonly string[] {
  if (event.detail && event.detail.length > 0) return event.detail

  const details: string[] = []
  if (event.vesselName && event.vesselName.trim().length > 0) {
    details.push(event.vesselName)
  }
  if (event.voyage && event.voyage.trim().length > 0) {
    details.push(event.voyage)
  }
  return details
}

function buildMscPayload(
  containerNumber: string,
  snapshot: Extract<ScenarioSnapshotBlueprint, { kind: 'msc' }>,
): unknown {
  const latestMove = snapshot.events[snapshot.events.length - 1]?.locationDisplay ?? null

  const events = snapshot.events.map((event, index) => {
    const detail = buildMscDetail(event)
    return {
      Date: toMscDate(event.eventTime),
      Order: index,
      Detail: detail,
      Vessel: {
        IMO: '',
        Flag: '',
        Built: '',
        FlagName: '',
      },
      Location: event.locationDisplay,
      Description: event.description,
      UnLocationCode: event.locationCode,
      EquipmentHandling: null,
      IntermediaryPortCalls: null,
    }
  })

  return {
    Data: {
      CurrentDate: snapshot.currentDate,
      TrackingType: 'Container',
      BillOfLadings: [
        {
          Delivered: false,
          ContainersInfo: [
            {
              Events: events,
              Delivered: false,
              LatestMove: latestMove,
              PodEtaDate: snapshot.podEtaDate ?? null,
              ContainerType: "40' HIGH CUBE",
              ContainerNumber: containerNumber,
            },
          ],
          BillOfLadingNumber: `LAB-${containerNumber}`,
          NumberOfContainers: 1,
          GeneralTrackingInfo: {
            PortOfDischarge: snapshot.podLocation ?? null,
            PortOfLoad: null,
            ShippedFrom: null,
            ShippedTo: snapshot.podLocation ?? null,
            Transshipments: [],
            FinalPodEtaDate: snapshot.podEtaDate ?? null,
          },
        },
      ],
      TrackingTitle: 'CONTAINER NUMBER:',
      TrackingNumber: containerNumber,
    },
    IsSuccess: true,
  }
}

function buildCmaMove(move: ScenarioCmaMoveSpec): {
  Date: string
  State: string
  Status: number
  Vessel: string | null
  Voyage: string | null
  Location: string
  LocationCode: string
  ModeOfTransport: string
  StatusDescription: string
  DateString: string
} {
  return {
    Date: toCmaMsDate(move.eventTime),
    State: move.state ?? 'DONE',
    Status: CMACGM_CONTAINER_STATUS_IN_TRANSIT,
    Vessel: move.vesselName ?? null,
    Voyage: move.voyage ?? null,
    Location: move.locationDisplay,
    LocationCode: move.locationCode,
    ModeOfTransport: move.vesselName ? 'VESSEL' : 'TRUCK',
    StatusDescription: move.statusDescription,
    DateString: move.eventTime,
  }
}

function buildCmaPayload(
  containerNumber: string,
  snapshot: Extract<ScenarioSnapshotBlueprint, { kind: 'cmacgm' }>,
): unknown {
  const estimatedTimeOfArrival = snapshot.estimatedTimeOfArrival
    ? toCmaMsDate(snapshot.estimatedTimeOfArrival)
    : null

  return {
    ContainerReference: containerNumber,
    EstimatedTimeOfArrival: estimatedTimeOfArrival,
    PlaceOfLoading: snapshot.placeOfLoading ?? null,
    LastDischargePort: snapshot.lastDischargePort ?? null,
    ContainerStatus: CMACGM_CONTAINER_STATUS_IN_TRANSIT,
    PastMoves: snapshot.moves.map((move) => buildCmaMove(move)),
    CurrentMoves: [],
    ProvisionalMoves: [],
  }
}

function buildSnapshotPayload(
  snapshot: ScenarioSnapshotBlueprint,
  containerNumber: string,
): unknown {
  if (snapshot.kind === 'maersk') {
    return buildMaerskPayload(containerNumber, snapshot.events)
  }

  if (snapshot.kind === 'msc') {
    return buildMscPayload(containerNumber, snapshot)
  }

  return buildCmaPayload(containerNumber, snapshot)
}

function clampStep(step: number, totalSteps: number): number {
  if (!Number.isFinite(step) || Number.isNaN(step)) return 1
  if (step < 1) return 1
  if (step > totalSteps) return totalSteps
  return Math.floor(step)
}

function buildSnapshotsUntilStep(
  scenario: TrackingScenario,
  appliedStep: number,
  containerNumbersByKey: ContainerNumbersByKey,
): readonly ScenarioStepSnapshot[] {
  const snapshots: ScenarioStepSnapshot[] = []

  for (const step of scenario.steps.slice(0, appliedStep)) {
    for (const snapshot of step.snapshots) {
      const containerNumber = containerNumbersByKey.get(snapshot.containerKey)
      if (!containerNumber) {
        throw new Error(
          `Scenario ${scenario.id} references unknown container key: ${snapshot.containerKey}`,
        )
      }

      snapshots.push({
        containerKey: snapshot.containerKey,
        provider: providerFromBlueprint(snapshot),
        fetchedAt: snapshot.fetchedAt,
        payload: buildSnapshotPayload(snapshot, containerNumber),
      })
    }
  }

  return snapshots
}

export function buildScenarioProcessReference(
  scenarioId: string,
  appliedStep: number,
  runToken: string,
): string {
  const normalizedScenarioId = normalizeReferenceToken(scenarioId)
  const normalizedRunToken = normalizeReferenceToken(runToken)
  return `LAB-${normalizedScenarioId}-${appliedStep}-${normalizedRunToken}`
}

export function generateScenarioRunToken(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 36 * 36)
    .toString(36)
    .padStart(2, '0')}`
}

export function buildScenarioContainerNumbers(params: {
  scenario: TrackingScenario
  appliedStep: number
  runToken: string
}): ReadonlyMap<string, string> {
  const byKey = new Map<string, string>()

  for (const container of params.scenario.containers) {
    const prefix = providerToContainerPrefix(container.provider)
    const hashInput = `${params.scenario.id}:${params.appliedStep}:${container.key}:${params.runToken}`
    const hash = hashString(hashInput)
    const suffix = String(hash % 10_000_000).padStart(7, '0')
    byKey.set(container.key, `${prefix}${suffix}`)
  }

  return byKey
}

export function buildScenario(params: {
  command: ScenarioLoadCommand
  runToken: string
}): ScenarioBuildResult {
  const scenario = getTrackingScenarioById(params.command.scenarioId)
  if (!scenario) {
    throw new Error(`Scenario not found: ${params.command.scenarioId}`)
  }

  const appliedStep = clampStep(params.command.step, scenario.steps.length)
  const containerNumbersByKey = buildScenarioContainerNumbers({
    scenario,
    appliedStep,
    runToken: params.runToken,
  })

  const snapshots = buildSnapshotsUntilStep(scenario, appliedStep, containerNumbersByKey)

  return {
    scenario,
    appliedStep,
    snapshots,
  }
}

export function buildScenarioContainerInputs(params: {
  scenario: TrackingScenario
  containerNumbersByKey: ContainerNumbersByKey
}): readonly { container_number: string; carrier_code: string | null }[] {
  return params.scenario.containers.map((container) => {
    const containerNumber = params.containerNumbersByKey.get(container.key)
    if (!containerNumber) {
      throw new Error(
        `Container number missing for scenario ${params.scenario.id} and key ${container.key}`,
      )
    }

    return {
      container_number: containerNumber,
      carrier_code: container.provider,
    }
  })
}

export function buildScenarioProviderByContainerKey(
  scenario: TrackingScenario,
): ReadonlyMap<string, Provider> {
  const map = new Map<string, Provider>()

  for (const container of scenario.containers) {
    map.set(container.key, container.provider)
  }

  return map
}
