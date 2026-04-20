import type {
  ScenarioCatalog,
  ScenarioCatalogGroup,
  ScenarioCmaMoveSpec,
  ScenarioMaerskEventSpec,
  ScenarioMscEventSpec,
  ScenarioSnapshotBlueprint,
  ScenarioStage,
  ScenarioStageDefinition,
  ScenarioStep,
  TrackingScenario,
  TrackingScenarioSummary,
} from '~/modules/tracking/dev/scenario-lab/scenario.types'
import type { Provider } from '~/modules/tracking/domain/model/provider'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function getBaseUtcMidnightMs(offsetDaysFromToday: number): number {
  const now = new Date()
  const todayUtcMidnightMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
  )

  return todayUtcMidnightMs + offsetDaysFromToday * ONE_DAY_MS
}

const PAST_BASE_MS = getBaseUtcMidnightMs(-60)
const FUTURE_BASE_MS = getBaseUtcMidnightMs(60)

function atFromBase(baseMs: number, day: number, hour: number, minute: number = 0): string {
  const millis = baseMs + ((day * 24 + hour) * 60 + minute) * 60 * 1000
  return new Date(millis).toISOString()
}

function atPast(day: number, hour: number, minute: number = 0): string {
  return atFromBase(PAST_BASE_MS, day, hour, minute)
}

function atFuture(day: number, hour: number, minute: number = 0): string {
  return atFromBase(FUTURE_BASE_MS, day, hour, minute)
}

function addMinutes(iso: string, minutes: number): string {
  const parsed = new Date(iso)
  return new Date(parsed.getTime() + minutes * 60 * 1000).toISOString()
}

function toMscDate(iso: string): string {
  const parsed = new Date(iso)
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const year = String(parsed.getUTCFullYear())
  return `${day}/${month}/${year}`
}

function buildLocationName(city: string, countryCode: string): string {
  return `${city}, ${countryCode}`
}

type LocationSpec = Readonly<{
  code: string
  city: string
  countryCode: string
}>

const LOC_DEPOT = {
  code: 'ITDEP',
  city: 'NAPLES DEPOT',
  countryCode: 'IT',
} as const satisfies LocationSpec

const LOC_POL = {
  code: 'ITNAP',
  city: 'NAPLES',
  countryCode: 'IT',
} as const satisfies LocationSpec

const LOC_TRANS = {
  code: 'MAPTM',
  city: 'TANGER MED',
  countryCode: 'MA',
} as const satisfies LocationSpec

const LOC_POD = {
  code: 'BRSSZ',
  city: 'SANTOS',
  countryCode: 'BR',
} as const satisfies LocationSpec

const LOC_DELIVERY = {
  code: 'BRIOA',
  city: 'ITAPOA',
  countryCode: 'BR',
} as const satisfies LocationSpec

function maerskEvent(params: {
  activity: string
  eventTime: string
  eventTimeType: 'ACTUAL' | 'EXPECTED'
  location: LocationSpec
  vesselName?: string | null
  voyage?: string | null
  isEmpty?: boolean | null
}): ScenarioMaerskEventSpec {
  return {
    activity: params.activity,
    eventTime: params.eventTime,
    eventTimeType: params.eventTimeType,
    locationCode: params.location.code,
    locationCity: params.location.city,
    locationCountryCode: params.location.countryCode,
    vesselName: params.vesselName ?? null,
    voyage: params.voyage ?? null,
    isEmpty: params.isEmpty ?? null,
  }
}

function mscEvent(params: {
  description: string
  eventTime: string
  locationCode: string
  locationDisplay: string
  vesselName?: string | null
  voyage?: string | null
  detail?: readonly string[]
}): ScenarioMscEventSpec {
  return {
    description: params.description,
    eventTime: params.eventTime,
    locationCode: params.locationCode,
    locationDisplay: params.locationDisplay,
    vesselName: params.vesselName ?? null,
    voyage: params.voyage ?? null,
    detail: params.detail ?? [],
  }
}

function cmaMove(params: {
  statusDescription: string
  eventTime: string
  locationCode: string
  locationDisplay: string
  state?: 'DONE' | 'CURRENT' | 'NONE'
  vesselName?: string | null
  voyage?: string | null
}): ScenarioCmaMoveSpec {
  return {
    statusDescription: params.statusDescription,
    eventTime: params.eventTime,
    locationCode: params.locationCode,
    locationDisplay: params.locationDisplay,
    state: params.state ?? 'DONE',
    vesselName: params.vesselName ?? null,
    voyage: params.voyage ?? null,
  }
}

function singleContainer(
  provider: Provider,
): readonly { key: string; label: string; provider: Provider }[] {
  return [{ key: 'c1', label: 'Primary container', provider }]
}

function processContainers(): readonly { key: string; label: string; provider: Provider }[] {
  return [
    { key: 'c1', label: 'Container A', provider: 'maersk' },
    { key: 'c2', label: 'Container B', provider: 'maersk' },
    { key: 'c3', label: 'Container C', provider: 'maersk' },
    { key: 'c4', label: 'Container D', provider: 'maersk' },
    { key: 'c5', label: 'Container E', provider: 'maersk' },
  ]
}

function latestEventTime(events: readonly ScenarioMaerskEventSpec[]): string | null {
  if (events.length === 0) return null

  let latest: string | null = null
  for (const event of events) {
    if (latest === null) {
      latest = event.eventTime
      continue
    }

    if (event.eventTime > latest) {
      latest = event.eventTime
    }
  }

  return latest
}

function maerskSnapshot(
  containerKey: string,
  fetchedAt: string,
  events: readonly ScenarioMaerskEventSpec[],
): ScenarioSnapshotBlueprint {
  return {
    kind: 'maersk',
    containerKey,
    fetchedAt,
    events,
  }
}

function mscSnapshot(params: {
  containerKey: string
  fetchedAt: string
  currentDate: string
  events: readonly ScenarioMscEventSpec[]
  podEtaDate?: string | null
  podLocation?: string | null
}): ScenarioSnapshotBlueprint {
  return {
    kind: 'msc',
    containerKey: params.containerKey,
    fetchedAt: params.fetchedAt,
    currentDate: params.currentDate,
    events: params.events,
    podEtaDate: params.podEtaDate ?? null,
    podLocation: params.podLocation ?? null,
  }
}

function cmaSnapshot(params: {
  containerKey: string
  fetchedAt: string
  moves: readonly ScenarioCmaMoveSpec[]
  estimatedTimeOfArrival?: string | null
  placeOfLoading?: string | null
  lastDischargePort?: string | null
}): ScenarioSnapshotBlueprint {
  return {
    kind: 'cmacgm',
    containerKey: params.containerKey,
    fetchedAt: params.fetchedAt,
    moves: params.moves,
    estimatedTimeOfArrival: params.estimatedTimeOfArrival ?? null,
    placeOfLoading: params.placeOfLoading ?? null,
    lastDischargePort: params.lastDischargePort ?? null,
  }
}

type ProgressiveStepInput = Readonly<{
  id: string
  title: string
  description: string
  newEvents: readonly ScenarioMaerskEventSpec[]
}>

function buildProgressiveMaerskSteps(
  containerKey: string,
  steps: readonly ProgressiveStepInput[],
): readonly ScenarioStep[] {
  let cumulative: ScenarioMaerskEventSpec[] = []

  return steps.map((step, index) => {
    cumulative = [...cumulative, ...step.newEvents]
    const latest = latestEventTime(cumulative)
    const fallback = atPast(index + 1, 0)

    return {
      id: step.id,
      title: step.title,
      description: step.description,
      snapshots: [
        maerskSnapshot(containerKey, addMinutes(latest ?? fallback, index + 2), cumulative),
      ],
    }
  })
}

function createScenario(input: {
  id: string
  title: string
  description: string
  category: 'lifecycle' | 'data_pathologies' | 'process_aggregation'
  stage: ScenarioStage
  tags: readonly string[]
  containers: readonly { key: string; label: string; provider: Provider }[]
  steps: readonly ScenarioStep[]
}): TrackingScenario {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    category: input.category,
    stage: input.stage,
    tags: input.tags,
    containers: input.containers,
    steps: input.steps,
  }
}

const EVT_BOOKING_DEPARTURE_EXPECTED_A = maerskEvent({
  activity: 'CONTAINER DEPARTURE',
  eventTime: atFuture(2, 8),
  eventTimeType: 'EXPECTED',
  location: LOC_POL,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_BOOKING_DEPARTURE_EXPECTED_B = maerskEvent({
  activity: 'CONTAINER DEPARTURE',
  eventTime: atFuture(3, 12),
  eventTimeType: 'EXPECTED',
  location: LOC_POL,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_BOOKING_ARRIVAL_EXPECTED_A = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atFuture(9, 10),
  eventTimeType: 'EXPECTED',
  location: LOC_POD,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_GATE_OUT_EMPTY = maerskEvent({
  activity: 'GATE-OUT',
  eventTime: atPast(0, 9),
  eventTimeType: 'ACTUAL',
  location: LOC_DEPOT,
  isEmpty: true,
})

const EVT_GATE_OUT_OLDER = maerskEvent({
  activity: 'GATE-OUT',
  eventTime: atPast(0, 7),
  eventTimeType: 'ACTUAL',
  location: LOC_DEPOT,
  isEmpty: true,
})

const EVT_GATE_OUT_DELIVERY = maerskEvent({
  activity: 'GATE-OUT',
  eventTime: atPast(11, 10),
  eventTimeType: 'ACTUAL',
  location: LOC_DELIVERY,
  isEmpty: false,
})

const EVT_GATE_IN_EXPECTED = maerskEvent({
  activity: 'GATE-IN',
  eventTime: atFuture(1, 9),
  eventTimeType: 'EXPECTED',
  location: LOC_POL,
  isEmpty: false,
})

const EVT_GATE_IN_ACTUAL = maerskEvent({
  activity: 'GATE-IN',
  eventTime: atPast(1, 10),
  eventTimeType: 'ACTUAL',
  location: LOC_POL,
  isEmpty: false,
})

const EVT_GATE_IN_ACTUAL_DUPLICATE = maerskEvent({
  activity: 'GATE-IN',
  eventTime: atPast(1, 10),
  eventTimeType: 'ACTUAL',
  location: LOC_POL,
  isEmpty: false,
})

const EVT_LOAD_EXPECTED = maerskEvent({
  activity: 'LOAD',
  eventTime: atFuture(4, 9),
  eventTimeType: 'EXPECTED',
  location: LOC_POL,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_LOAD_ACTUAL = maerskEvent({
  activity: 'LOAD',
  eventTime: atPast(2, 8),
  eventTimeType: 'ACTUAL',
  location: LOC_POL,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_LOAD_ACTUAL_DUPLICATE = maerskEvent({
  activity: 'LOAD',
  eventTime: atPast(2, 8),
  eventTimeType: 'ACTUAL',
  location: LOC_POL,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_DEPARTURE_ACTUAL = maerskEvent({
  activity: 'CONTAINER DEPARTURE',
  eventTime: atPast(2, 12),
  eventTimeType: 'ACTUAL',
  location: LOC_POL,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_TRANS_DISCHARGE = maerskEvent({
  activity: 'DISCHARGE',
  eventTime: atPast(6, 10),
  eventTimeType: 'ACTUAL',
  location: LOC_TRANS,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_TRANS_DISCHARGE_DUPLICATE = maerskEvent({
  activity: 'DISCHARGE',
  eventTime: atPast(6, 14),
  eventTimeType: 'ACTUAL',
  location: LOC_TRANS,
  vesselName: 'LAB ALPHA',
  voyage: 'LA101E',
})

const EVT_TRANS_LOAD = maerskEvent({
  activity: 'LOAD',
  eventTime: atPast(7, 9),
  eventTimeType: 'ACTUAL',
  location: LOC_TRANS,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_TRANS_LOAD_EXPECTED = maerskEvent({
  activity: 'LOAD',
  eventTime: atFuture(6, 10),
  eventTimeType: 'EXPECTED',
  location: LOC_TRANS,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_ARRIVAL_EXPECTED_A = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atFuture(8, 9),
  eventTimeType: 'EXPECTED',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_ARRIVAL_EXPECTED_B = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atFuture(9, 12),
  eventTimeType: 'EXPECTED',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_ARRIVAL_EXPECTED_EXPIRED = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atPast(8, 9),
  eventTimeType: 'EXPECTED',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_ARRIVAL_EXPECTED_AFTER_ACTUAL = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atFuture(10, 14),
  eventTimeType: 'EXPECTED',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_ARRIVAL_ACTUAL = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atPast(9, 8),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_ARRIVAL_ACTUAL_LATE = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atPast(10, 11),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_DISCHARGE_ACTUAL = maerskEvent({
  activity: 'DISCHARGE',
  eventTime: atPast(9, 12),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_DISCHARGE_ACTUAL_SECOND = maerskEvent({
  activity: 'DISCHARGE',
  eventTime: atPast(9, 18),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
  vesselName: 'LAB BETA',
  voyage: 'LB207W',
})

const EVT_DELIVERY_ACTUAL = maerskEvent({
  activity: 'DELIVERED',
  eventTime: atPast(11, 8),
  eventTimeType: 'ACTUAL',
  location: LOC_DELIVERY,
})

const EVT_EMPTY_RETURN_EXPECTED = maerskEvent({
  activity: 'EMPTY RETURN',
  eventTime: atFuture(12, 9),
  eventTimeType: 'EXPECTED',
  location: LOC_DELIVERY,
  isEmpty: true,
})

const EVT_EMPTY_RETURN_ACTUAL = maerskEvent({
  activity: 'EMPTY RETURN',
  eventTime: atPast(12, 14),
  eventTimeType: 'ACTUAL',
  location: LOC_DELIVERY,
  isEmpty: true,
})

const EVT_POST_COMPLETION_LOAD_ACTUAL = maerskEvent({
  activity: 'LOAD',
  eventTime: atPast(15, 8),
  eventTimeType: 'ACTUAL',
  location: LOC_POL,
  vesselName: 'LAB GAMMA',
  voyage: 'LG309E',
})

const EVT_POST_CARRIAGE_DEPARTURE_ACTUAL = maerskEvent({
  activity: 'CONTAINER DEPARTURE',
  eventTime: atPast(10, 18),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
  vesselName: 'LAB SIGMA',
  voyage: 'LS401W',
})

const EVT_POST_CARRIAGE_ARRIVAL_ACTUAL = maerskEvent({
  activity: 'CONTAINER ARRIVAL',
  eventTime: atPast(11, 6),
  eventTimeType: 'ACTUAL',
  location: LOC_DELIVERY,
  vesselName: 'LAB SIGMA',
  voyage: 'LS401W',
})

const EVT_POST_CARRIAGE_LOAD_ACTUAL = maerskEvent({
  activity: 'LOAD',
  eventTime: atPast(10, 12),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
  vesselName: 'LAB SIGMA',
  voyage: 'LS401W',
})

const EVT_CUSTOMS_HOLD = maerskEvent({
  activity: 'CUSTOMS HOLD',
  eventTime: atPast(9, 16),
  eventTimeType: 'ACTUAL',
  location: LOC_POD,
})

const MSC_EMPTY_TO_SHIPPER = mscEvent({
  description: 'Empty to Shipper',
  eventTime: atPast(0, 8),
  locationCode: 'ITNAP',
  locationDisplay: 'NAPLES, IT',
  detail: ['EMPTY'],
})

const MSC_LEG_AWARE_KARACHI_LOAD = mscEvent({
  description: 'Export Loaded on Vessel',
  eventTime: atPast(18, 10),
  locationCode: 'PKKHI',
  locationDisplay: 'KARACHI, PK',
  vesselName: 'MSC ARICA',
  voyage: 'OB610R',
})

const MSC_LEG_AWARE_COLOMBO_DISCHARGE = mscEvent({
  description: 'Full Transshipment Discharged',
  eventTime: atPast(27, 10),
  locationCode: 'LKCMB',
  locationDisplay: 'COLOMBO, LK',
  vesselName: 'MSC ARICA',
  voyage: 'IV610A',
})

const MSC_LEG_AWARE_COLOMBO_DISCHARGE_DUPLICATE = mscEvent({
  description: 'Full Transshipment Discharged',
  eventTime: atPast(27, 10),
  locationCode: 'LKCMB',
  locationDisplay: 'COLOMBO, LK',
  vesselName: 'MSC ARICA',
  voyage: 'OB610R',
})

const MSC_LEG_AWARE_COLOMBO_POSITIONED_IN = mscEvent({
  description: 'Full Transshipment Positioned In',
  eventTime: atPast(28, 8),
  locationCode: 'LKCMB',
  locationDisplay: 'COLOMBO, LK',
})

const MSC_LEG_AWARE_COLOMBO_POSITIONED_OUT = mscEvent({
  description: 'Full Transshipment Positioned Out',
  eventTime: atPast(28, 18),
  locationCode: 'LKCMB',
  locationDisplay: 'COLOMBO, LK',
})

const MSC_LEG_AWARE_COLOMBO_LOAD = mscEvent({
  description: 'Full Transshipment Loaded',
  eventTime: atPast(30, 10),
  locationCode: 'LKCMB',
  locationDisplay: 'COLOMBO, LK',
  vesselName: 'GSL VIOLETTA',
  voyage: 'ZF609R',
})

const MSC_LEG_AWARE_SINGAPORE_DISCHARGE = mscEvent({
  description: 'Import Discharged from Vessel',
  eventTime: atPast(37, 10),
  locationCode: 'SGSIN',
  locationDisplay: 'SINGAPORE, SG',
  vesselName: 'GSL VIOLETTA',
  voyage: 'ZF609R',
})

const CMACGM_EMPTY_TO_SHIPPER = cmaMove({
  statusDescription: 'Empty to shipper',
  eventTime: atPast(0, 7),
  locationCode: 'ESBCN',
  locationDisplay: 'BARCELONA',
  state: 'DONE',
})

function buildLifecycleScenarios(): readonly TrackingScenario[] {
  const bookingBaseSteps: readonly ProgressiveStepInput[] = [
    {
      id: 'step-1',
      title: 'Booking registered',
      description: 'Carrier returned only a predicted departure.',
      newEvents: [EVT_BOOKING_DEPARTURE_EXPECTED_A],
    },
  ]

  return [
    createScenario({
      id: 'unknown.never_synced',
      title: 'Unknown · Never Synced',
      description: 'Container exists in process but no snapshots were ever synced.',
      category: 'lifecycle',
      stage: 0,
      tags: ['unknown', 'empty-state'],
      containers: singleContainer('maersk'),
      steps: [
        {
          id: 'step-1',
          title: 'No snapshots',
          description: 'No snapshots are injected.',
          snapshots: [],
        },
      ],
    }),
    createScenario({
      id: 'unknown.container_not_found',
      title: 'Unknown · Container Not Found',
      description: 'Simulates a target with no usable tracking payload.',
      category: 'lifecycle',
      stage: 0,
      tags: ['unknown', 'lookup'],
      containers: singleContainer('maersk'),
      steps: [
        {
          id: 'step-1',
          title: 'No facts',
          description: 'No observations can be derived.',
          snapshots: [],
        },
      ],
    }),
    createScenario({
      id: 'unknown.provider_error',
      title: 'Unknown · Provider Error',
      description: 'Provider failed before any parsable payload was produced.',
      category: 'lifecycle',
      stage: 0,
      tags: ['unknown', 'provider-error'],
      containers: singleContainer('maersk'),
      steps: [
        {
          id: 'step-1',
          title: 'Provider failed',
          description: 'Scenario intentionally injects zero snapshots.',
          snapshots: [],
        },
      ],
    }),

    createScenario({
      id: 'booking.basic',
      title: 'Booking · Basic',
      description: 'Only expected departure is available.',
      category: 'lifecycle',
      stage: 1,
      tags: ['booking', 'expected-series'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', bookingBaseSteps),
    }),
    createScenario({
      id: 'booking.expected_departure',
      title: 'Booking · Expected Departure Update',
      description: 'Expected departure updated by carrier.',
      category: 'lifecycle',
      stage: 1,
      tags: ['booking', 'expected-series'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        ...bookingBaseSteps,
        {
          id: 'step-2',
          title: 'Updated departure ETA',
          description: 'Carrier shifted predicted departure.',
          newEvents: [EVT_BOOKING_DEPARTURE_EXPECTED_B],
        },
      ]),
    }),
    createScenario({
      id: 'booking.multiple_expected_updates',
      title: 'Booking · Multiple Expected Updates',
      description: 'Predicted departure and arrival evolve without ACTUAL.',
      category: 'lifecycle',
      stage: 1,
      tags: ['booking', 'expected-series'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        ...bookingBaseSteps,
        {
          id: 'step-2',
          title: 'Departure reforecast',
          description: 'Expected departure changed again.',
          newEvents: [EVT_BOOKING_DEPARTURE_EXPECTED_B],
        },
        {
          id: 'step-3',
          title: 'Arrival forecast available',
          description: 'Carrier also provides expected arrival.',
          newEvents: [EVT_BOOKING_ARRIVAL_EXPECTED_A],
        },
      ]),
    }),

    createScenario({
      id: 'maersk.empty_gate_out',
      title: 'Pre-Gate · Maersk Empty Gate Out',
      description: 'Carrier-specific mapping for empty gate out (Maersk).',
      category: 'lifecycle',
      stage: 2,
      tags: ['pre-gate', 'mapping', 'maersk'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Empty gate out',
          description: 'Container leaves depot empty.',
          newEvents: [EVT_GATE_OUT_EMPTY],
        },
      ]),
    }),
    createScenario({
      id: 'msc.empty_gate_out',
      title: 'Pre-Gate · MSC Empty Gate Out',
      description: 'Carrier-specific mapping for empty gate out (MSC).',
      category: 'lifecycle',
      stage: 2,
      tags: ['pre-gate', 'mapping', 'msc'],
      containers: singleContainer('msc'),
      steps: [
        {
          id: 'step-1',
          title: 'MSC empty to shipper',
          description: 'MSC payload contains Empty to Shipper.',
          snapshots: [
            mscSnapshot({
              containerKey: 'c1',
              fetchedAt: addMinutes(MSC_EMPTY_TO_SHIPPER.eventTime, 20),
              currentDate: toMscDate(atPast(0, 20)),
              events: [MSC_EMPTY_TO_SHIPPER],
              podEtaDate: toMscDate(atFuture(10, 8)),
              podLocation: buildLocationName(LOC_POD.city, LOC_POD.countryCode),
            }),
          ],
        },
      ],
    }),
    createScenario({
      id: 'cmacgm.empty_gate_out',
      title: 'Pre-Gate · CMA CGM Empty Gate Out',
      description: 'Carrier-specific mapping for empty gate out (CMA CGM).',
      category: 'lifecycle',
      stage: 2,
      tags: ['pre-gate', 'mapping', 'cmacgm'],
      containers: singleContainer('cmacgm'),
      steps: [
        {
          id: 'step-1',
          title: 'CMA empty to shipper',
          description: 'CMA payload encodes Empty to shipper move.',
          snapshots: [
            cmaSnapshot({
              containerKey: 'c1',
              fetchedAt: addMinutes(CMACGM_EMPTY_TO_SHIPPER.eventTime, 20),
              moves: [CMACGM_EMPTY_TO_SHIPPER],
              estimatedTimeOfArrival: atFuture(12, 9),
              placeOfLoading: buildLocationName(LOC_POL.city, LOC_POL.countryCode),
              lastDischargePort: buildLocationName(LOC_POD.city, LOC_POD.countryCode),
            }),
          ],
        },
      ],
    }),

    createScenario({
      id: 'gate_in_basic',
      title: 'Gate In · Basic',
      description: 'Gate out followed by gate in ACTUAL.',
      category: 'lifecycle',
      stage: 3,
      tags: ['gate-in'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Gate out',
          description: 'Empty gate out recorded.',
          newEvents: [EVT_GATE_OUT_EMPTY],
        },
        {
          id: 'step-2',
          title: 'Gate in',
          description: 'Container received at CY.',
          newEvents: [EVT_GATE_IN_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'gate_in_duplicate',
      title: 'Gate In · Duplicate',
      description: 'Duplicate ACTUAL gate-in appears in the same sync.',
      category: 'lifecycle',
      stage: 3,
      tags: ['gate-in', 'duplicate'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Duplicate gate-in payload',
          description: 'Same gate-in fact appears twice.',
          newEvents: [EVT_GATE_OUT_EMPTY, EVT_GATE_IN_ACTUAL, EVT_GATE_IN_ACTUAL_DUPLICATE],
        },
      ]),
    }),
    createScenario({
      id: 'gate_in_expected_then_actual',
      title: 'Gate In · Expected Then Actual',
      description: 'Expected gate-in is later confirmed as ACTUAL.',
      category: 'lifecycle',
      stage: 3,
      tags: ['gate-in', 'expected'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Expected gate-in',
          description: 'Gate-in ETA appears first.',
          newEvents: [EVT_GATE_IN_EXPECTED],
        },
        {
          id: 'step-2',
          title: 'Actual gate-in',
          description: 'Carrier confirms gate-in.',
          newEvents: [EVT_GATE_IN_ACTUAL],
        },
      ]),
    }),

    createScenario({
      id: 'loaded_direct',
      title: 'Loaded · Direct',
      description: 'Container progresses from gate in to load.',
      category: 'lifecycle',
      stage: 4,
      tags: ['loaded'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Gate-in actual',
          description: 'Container entered CY.',
          newEvents: [EVT_GATE_IN_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Loaded on vessel',
          description: 'Load event confirmed.',
          newEvents: [EVT_LOAD_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'loaded_expected_then_actual',
      title: 'Loaded · Expected Then Actual',
      description: 'Expected load transitions to ACTUAL load.',
      category: 'lifecycle',
      stage: 4,
      tags: ['loaded', 'expected'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Gate-in actual',
          description: 'Container entered CY.',
          newEvents: [EVT_GATE_IN_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Load expected',
          description: 'Carrier predicts load.',
          newEvents: [EVT_LOAD_EXPECTED],
        },
        {
          id: 'step-3',
          title: 'Load actual',
          description: 'Load is confirmed.',
          newEvents: [EVT_LOAD_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'loaded_duplicate_events',
      title: 'Loaded · Duplicate Events',
      description: 'Carrier emits duplicated load ACTUAL events.',
      category: 'lifecycle',
      stage: 4,
      tags: ['loaded', 'duplicate'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Duplicated load',
          description: 'One snapshot contains duplicated load events.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_LOAD_ACTUAL_DUPLICATE],
        },
      ]),
    }),

    createScenario({
      id: 'in_transit_basic',
      title: 'In Transit · Basic',
      description: 'Departure ACTUAL puts container in transit.',
      category: 'lifecycle',
      stage: 5,
      tags: ['in-transit'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Loaded',
          description: 'Container loaded onto vessel.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Departure',
          description: 'Vessel departure confirmed.',
          newEvents: [EVT_DEPARTURE_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'in_transit_eta_predictions',
      title: 'In Transit · ETA Predictions',
      description: 'ETA evolves while container stays in transit.',
      category: 'lifecycle',
      stage: 5,
      tags: ['in-transit', 'eta'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Departure',
          description: 'Transit started.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'ETA v1',
          description: 'First arrival forecast.',
          newEvents: [EVT_ARRIVAL_EXPECTED_A],
        },
        {
          id: 'step-3',
          title: 'ETA v2',
          description: 'Carrier publishes another ETA.',
          newEvents: [EVT_ARRIVAL_EXPECTED_B],
        },
      ]),
    }),
    createScenario({
      id: 'in_transit_stagnation',
      title: 'In Transit · Stagnation',
      description: 'No new movement after departure across sync cycles.',
      category: 'lifecycle',
      stage: 5,
      tags: ['in-transit', 'monitoring'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Departure',
          description: 'Transit started.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'No movement sync #1',
          description: 'Resync with no new events.',
          newEvents: [],
        },
        {
          id: 'step-3',
          title: 'No movement sync #2',
          description: 'Another resync still without movement.',
          newEvents: [],
        },
      ]),
    }),

    createScenario({
      id: 'transshipment_clean',
      title: 'Transshipment · Clean',
      description: 'Clean discharge and load with vessel change.',
      category: 'lifecycle',
      stage: 6,
      tags: ['transshipment'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Main leg departure',
          description: 'Container leaves origin.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Discharged at transshipment',
          description: 'Discharge at intermediate port.',
          newEvents: [EVT_TRANS_DISCHARGE],
        },
        {
          id: 'step-3',
          title: 'Loaded on new vessel',
          description: 'Transshipment load completed.',
          newEvents: [EVT_TRANS_LOAD],
        },
      ]),
    }),
    createScenario({
      id: 'transshipment_delay',
      title: 'Transshipment · Delay',
      description: 'Discharged at transshipment with delayed expected load.',
      category: 'lifecycle',
      stage: 6,
      tags: ['transshipment', 'delay'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Reached transshipment port',
          description: 'Container is discharged at transshipment.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_TRANS_DISCHARGE,
          ],
        },
        {
          id: 'step-2',
          title: 'Expected reload delayed',
          description: 'Only expected reload available.',
          newEvents: [EVT_TRANS_LOAD_EXPECTED],
        },
      ]),
    }),
    createScenario({
      id: 'transshipment_missing_load',
      title: 'Transshipment · Missing Load',
      description: 'Intermediate discharge exists but no follow-up load.',
      category: 'lifecycle',
      stage: 6,
      tags: ['transshipment', 'missing-data'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Discharged at transshipment',
          description: 'No load event follows.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_TRANS_DISCHARGE,
          ],
        },
      ]),
    }),
    createScenario({
      id: 'transshipment_double_discharge',
      title: 'Transshipment · Double Discharge',
      description: 'Two ACTUAL discharges at transshipment before reload.',
      category: 'lifecycle',
      stage: 6,
      tags: ['transshipment', 'conflict'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'First discharge',
          description: 'Container discharged once.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_TRANS_DISCHARGE,
          ],
        },
        {
          id: 'step-2',
          title: 'Duplicate discharge',
          description: 'Carrier reports another ACTUAL discharge in same series.',
          newEvents: [EVT_TRANS_DISCHARGE_DUPLICATE],
        },
        {
          id: 'step-3',
          title: 'Reload after conflict',
          description: 'Container is loaded on next vessel.',
          newEvents: [EVT_TRANS_LOAD],
        },
      ]),
    }),

    createScenario({
      id: 'arrival_expected_then_actual',
      title: 'Arrived POD · Expected Then Actual',
      description: 'Arrival expected is later confirmed as ACTUAL.',
      category: 'lifecycle',
      stage: 7,
      tags: ['arrival', 'expected'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'In transit',
          description: 'Container departed origin.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Arrival expected',
          description: 'Arrival ETA appears.',
          newEvents: [EVT_ARRIVAL_EXPECTED_A],
        },
        {
          id: 'step-3',
          title: 'Arrival actual',
          description: 'POD arrival confirmed.',
          newEvents: [EVT_ARRIVAL_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'arrival_without_discharge',
      title: 'Arrived POD · Without Discharge',
      description: 'Arrival ACTUAL exists but no discharge yet.',
      category: 'lifecycle',
      stage: 7,
      tags: ['arrival'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Arrival at POD',
          description: 'Arrival observed before discharge is available.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
          ],
        },
      ]),
    }),
    createScenario({
      id: 'arrival_late_eta',
      title: 'Arrived POD · Late ETA',
      description: 'Expired expected arrival then late ACTUAL arrival.',
      category: 'lifecycle',
      stage: 7,
      tags: ['arrival', 'eta', 'expired-expected'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Old ETA',
          description: 'Expected arrival already expired.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_EXPECTED_EXPIRED,
          ],
        },
        {
          id: 'step-2',
          title: 'Late actual arrival',
          description: 'Actual arrival arrives later than ETA.',
          newEvents: [EVT_ARRIVAL_ACTUAL_LATE],
        },
      ]),
    }),

    createScenario({
      id: 'discharge_basic',
      title: 'Discharged · Basic',
      description: 'Arrival followed by discharge ACTUAL.',
      category: 'lifecycle',
      stage: 8,
      tags: ['discharge'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Arrival',
          description: 'Container arrived at POD.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Discharge',
          description: 'Container discharged at POD.',
          newEvents: [EVT_DISCHARGE_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'discharge_multiple_actual',
      title: 'Discharged · Multiple ACTUAL',
      description: 'Conflicting ACTUAL discharges are preserved.',
      category: 'lifecycle',
      stage: 8,
      tags: ['discharge', 'conflict'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Conflicting discharges',
          description: 'Two discharge ACTUAL events in same series.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
            EVT_DISCHARGE_ACTUAL_SECOND,
          ],
        },
      ]),
    }),
    createScenario({
      id: 'discharge_without_arrival',
      title: 'Discharged · Without Arrival',
      description: 'Discharge appears without ARRIVAL event.',
      category: 'lifecycle',
      stage: 8,
      tags: ['discharge', 'missing-data'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Discharge without arrival',
          description: 'Carrier skipped arrival emission.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
      ]),
    }),

    createScenario({
      id: 'delivery_explicit',
      title: 'Delivered · Explicit Delivery Event',
      description: 'Carrier sends delivery ACTUAL.',
      category: 'lifecycle',
      stage: 9,
      tags: ['delivery'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Discharged',
          description: 'Container already discharged.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Delivered',
          description: 'Delivery event confirms final handoff.',
          newEvents: [EVT_DELIVERY_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'delivery_gate_out',
      title: 'Delivered · Gate Out For Delivery',
      description: 'Delivery inferred from gate-out behavior.',
      category: 'lifecycle',
      stage: 9,
      tags: ['delivery', 'carrier-inconsistency'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Discharged',
          description: 'Container at POD terminal.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Gate-out for delivery',
          description: 'No explicit DELIVERY event provided.',
          newEvents: [EVT_GATE_OUT_DELIVERY],
        },
      ]),
    }),
    createScenario({
      id: 'delivery_without_discharge',
      title: 'Delivered · Without Discharge',
      description: 'Delivery appears before discharge in carrier history.',
      category: 'lifecycle',
      stage: 9,
      tags: ['delivery', 'missing-data'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Delivered without discharge',
          description: 'Carrier emitted delivery directly.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_DELIVERY_ACTUAL,
          ],
        },
      ]),
    }),

    createScenario({
      id: 'empty_return_basic',
      title: 'Empty Return · Basic',
      description: 'Delivery followed by empty return ACTUAL.',
      category: 'lifecycle',
      stage: 10,
      tags: ['empty-return'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Delivered',
          description: 'Container delivered to consignee.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
            EVT_DELIVERY_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Empty returned',
          description: 'Container returned empty to depot.',
          newEvents: [EVT_EMPTY_RETURN_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'empty_return_late',
      title: 'Empty Return · Late',
      description: 'Expected empty return appears before late ACTUAL.',
      category: 'lifecycle',
      stage: 10,
      tags: ['empty-return', 'expected'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Delivered',
          description: 'Container delivered.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
            EVT_DELIVERY_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Expected empty return',
          description: 'Carrier predicts empty return.',
          newEvents: [EVT_EMPTY_RETURN_EXPECTED],
        },
        {
          id: 'step-3',
          title: 'Late empty return actual',
          description: 'Actual empty return arrives later.',
          newEvents: [EVT_EMPTY_RETURN_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'empty_return_missing_delivery',
      title: 'Empty Return · Missing Delivery',
      description: 'Empty return event exists without explicit delivery.',
      category: 'lifecycle',
      stage: 10,
      tags: ['empty-return', 'missing-data'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Empty return without delivery',
          description: 'Carrier skipped delivery fact.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
            EVT_EMPTY_RETURN_ACTUAL,
          ],
        },
      ]),
    }),
    createScenario({
      id: 'delivery_post_completion_continued',
      title: 'Pathology · Delivered With Continued Tracking',
      description: 'A delivered container starts a new incompatible load cycle.',
      category: 'data_pathologies',
      stage: 9,
      tags: ['pathology', 'post-completion', 'delivery', 'reused-container'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Delivered',
          description: 'Container reaches strong delivery completion.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
            EVT_DELIVERY_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Incompatible new cycle',
          description: 'A later load appears as if the same process resumed.',
          newEvents: [EVT_POST_COMPLETION_LOAD_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'empty_return_post_completion_continued',
      title: 'Pathology · Empty Return With Continued Tracking',
      description: 'An empty returned container starts a new incompatible load cycle.',
      category: 'data_pathologies',
      stage: 10,
      tags: ['pathology', 'post-completion', 'empty-return', 'reused-container'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Empty returned',
          description: 'Container reaches strong empty-return completion.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
            EVT_DELIVERY_ACTUAL,
            EVT_EMPTY_RETURN_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Incompatible new cycle',
          description: 'A later load appears as if the same process resumed.',
          newEvents: [EVT_POST_COMPLETION_LOAD_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'post_carriage_maritime_inconsistent',
      title: 'Pathology · Post-Carriage Maritime Event',
      description:
        'A maritime departure appears after discharge, then evolves and is later reconciled into a new predicted leg.',
      category: 'data_pathologies',
      stage: 10,
      tags: ['pathology', 'advisory', 'post-carriage', 'timeline-classification'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Discharged',
          description: 'Container finishes the last maritime leg with a discharge.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Stray maritime departure',
          description: 'A departure appears in post-carriage without a new canonical voyage leg.',
          newEvents: [EVT_POST_CARRIAGE_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-3',
          title: 'Stray arrival joins the anomaly',
          description: 'A follow-up arrival changes the advisory evidence without resolving it.',
          newEvents: [EVT_POST_CARRIAGE_ARRIVAL_ACTUAL],
        },
        {
          id: 'step-4',
          title: 'Retroactive load legitimizes the leg',
          description:
            'A retroactive load anchors the events into a canonical voyage leg and resolves the advisory.',
          newEvents: [EVT_POST_CARRIAGE_LOAD_ACTUAL],
        },
      ]),
    }),
  ]
}

function processSnapshotForEvents(
  containerKey: string,
  events: readonly ScenarioMaerskEventSpec[],
): ScenarioSnapshotBlueprint {
  const latest = latestEventTime(events)
  return maerskSnapshot(containerKey, addMinutes(latest ?? atPast(0, 0), 3), events)
}

function buildProcessAggregationScenarios(): readonly TrackingScenario[] {
  const containers = processContainers()

  const inTransitEvents = [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL]
  const arrivedEvents = [
    EVT_GATE_IN_ACTUAL,
    EVT_LOAD_ACTUAL,
    EVT_DEPARTURE_ACTUAL,
    EVT_ARRIVAL_ACTUAL,
  ]
  const dischargedEvents = [...arrivedEvents, EVT_DISCHARGE_ACTUAL]
  const deliveredEvents = [...dischargedEvents, EVT_DELIVERY_ACTUAL]

  return [
    createScenario({
      id: 'process.all_in_transit',
      title: 'Process · All In Transit',
      description: 'All containers are in transit.',
      category: 'process_aggregation',
      stage: 5,
      tags: ['process', 'aggregation'],
      containers,
      steps: [
        {
          id: 'step-1',
          title: 'All in transit',
          description: 'Every container has departure ACTUAL.',
          snapshots: [
            processSnapshotForEvents('c1', inTransitEvents),
            processSnapshotForEvents('c2', inTransitEvents),
            processSnapshotForEvents('c3', inTransitEvents),
            processSnapshotForEvents('c4', inTransitEvents),
            processSnapshotForEvents('c5', inTransitEvents),
          ],
        },
      ],
    }),
    createScenario({
      id: 'process.mixed_transit_and_discharged',
      title: 'Process · Mixed Transit And Discharged',
      description: 'Blend of in-transit, arrived and discharged containers.',
      category: 'process_aggregation',
      stage: 8,
      tags: ['process', 'aggregation', 'mixed-status'],
      containers,
      steps: [
        {
          id: 'step-1',
          title: 'Mixed operational states',
          description: 'Dashboard must aggregate heterogeneous statuses.',
          snapshots: [
            processSnapshotForEvents('c1', inTransitEvents),
            processSnapshotForEvents('c2', inTransitEvents),
            processSnapshotForEvents('c3', arrivedEvents),
            processSnapshotForEvents('c4', dischargedEvents),
            processSnapshotForEvents('c5', dischargedEvents),
          ],
        },
      ],
    }),
    createScenario({
      id: 'process.one_delivered_four_in_transit',
      title: 'Process · One Delivered Four In Transit',
      description: 'Single delivered container while others are still moving.',
      category: 'process_aggregation',
      stage: 9,
      tags: ['process', 'aggregation', 'mixed-status'],
      containers,
      steps: [
        {
          id: 'step-1',
          title: 'One delivered, others in transit',
          description: 'Operational summary should reflect dominant uncertainty.',
          snapshots: [
            processSnapshotForEvents('c1', deliveredEvents),
            processSnapshotForEvents('c2', inTransitEvents),
            processSnapshotForEvents('c3', inTransitEvents),
            processSnapshotForEvents('c4', inTransitEvents),
            processSnapshotForEvents('c5', inTransitEvents),
          ],
        },
      ],
    }),
    createScenario({
      id: 'process.all_delivered',
      title: 'Process · All Delivered',
      description: 'All containers reached delivery stage.',
      category: 'process_aggregation',
      stage: 9,
      tags: ['process', 'aggregation', 'completed'],
      containers,
      steps: [
        {
          id: 'step-1',
          title: 'All delivered',
          description: 'No in-transit container remains.',
          snapshots: [
            processSnapshotForEvents('c1', deliveredEvents),
            processSnapshotForEvents('c2', deliveredEvents),
            processSnapshotForEvents('c3', deliveredEvents),
            processSnapshotForEvents('c4', deliveredEvents),
            processSnapshotForEvents('c5', deliveredEvents),
          ],
        },
      ],
    }),
    createScenario({
      id: 'process.in_transit_but_alerts',
      title: 'Process · In Transit But Alerts',
      description: 'Containers remain in transit with data/monitoring alerts.',
      category: 'process_aggregation',
      stage: 6,
      tags: ['process', 'aggregation', 'alerts'],
      containers,
      steps: [
        {
          id: 'step-1',
          title: 'Operationally risky transit',
          description: 'One customs hold, one transshipment, others stale in transit.',
          snapshots: [
            processSnapshotForEvents('c1', [
              EVT_GATE_IN_ACTUAL,
              EVT_LOAD_ACTUAL,
              EVT_DEPARTURE_ACTUAL,
              EVT_TRANS_DISCHARGE,
              EVT_TRANS_LOAD,
            ]),
            processSnapshotForEvents('c2', [
              EVT_GATE_IN_ACTUAL,
              EVT_LOAD_ACTUAL,
              EVT_DEPARTURE_ACTUAL,
              EVT_ARRIVAL_ACTUAL,
              EVT_CUSTOMS_HOLD,
            ]),
            processSnapshotForEvents('c3', inTransitEvents),
            processSnapshotForEvents('c4', inTransitEvents),
            processSnapshotForEvents('c5', inTransitEvents),
          ],
        },
      ],
    }),
  ]
}

function buildPathologyScenarios(): readonly TrackingScenario[] {
  return [
    createScenario({
      id: 'conflict.double_actual',
      title: 'Pathology · Conflict Double ACTUAL',
      description: 'Two ACTUAL events in same discharge series.',
      category: 'data_pathologies',
      stage: 8,
      tags: ['pathology', 'conflict'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Initial discharge',
          description: 'First discharge ACTUAL.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Second discharge ACTUAL',
          description: 'Conflicting ACTUAL preserved as additional fact.',
          newEvents: [EVT_DISCHARGE_ACTUAL_SECOND],
        },
      ]),
    }),
    createScenario({
      id: 'expected_after_actual',
      title: 'Pathology · Expected After Actual',
      description: 'Carrier emits EXPECTED after an ACTUAL in same series.',
      category: 'data_pathologies',
      stage: 7,
      tags: ['pathology', 'expected-after-actual'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Actual arrival',
          description: 'Arrival ACTUAL is already known.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
          ],
        },
        {
          id: 'step-2',
          title: 'Late expected arrival',
          description: 'Expected update appears after actual fact.',
          newEvents: [EVT_ARRIVAL_EXPECTED_AFTER_ACTUAL],
        },
      ]),
    }),
    createScenario({
      id: 'missing_departure',
      title: 'Pathology · Missing Departure',
      description: 'Load and arrival exist without departure.',
      category: 'data_pathologies',
      stage: 7,
      tags: ['pathology', 'missing-departure'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Sparse carrier history',
          description: 'Departure fact is absent in payload.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_ARRIVAL_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
      ]),
    }),
    createScenario({
      id: 'missing_arrival',
      title: 'Pathology · Missing Arrival',
      description: 'Departure and discharge exist without arrival.',
      category: 'data_pathologies',
      stage: 8,
      tags: ['pathology', 'missing-arrival'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Arrival omitted',
          description: 'Carrier skipped arrival event.',
          newEvents: [
            EVT_GATE_IN_ACTUAL,
            EVT_LOAD_ACTUAL,
            EVT_DEPARTURE_ACTUAL,
            EVT_DISCHARGE_ACTUAL,
          ],
        },
      ]),
    }),
    createScenario({
      id: 'duplicate_snapshots',
      title: 'Pathology · Duplicate Snapshots',
      description: 'Same snapshot is ingested multiple times.',
      category: 'data_pathologies',
      stage: 5,
      tags: ['pathology', 'duplicate-snapshot', 'idempotency'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'First ingest',
          description: 'Initial payload ingestion.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Duplicate ingest',
          description: 'Exact same payload ingested again.',
          newEvents: [],
        },
      ]),
    }),
    createScenario({
      id: 'msc.leg_aware_missing_milestone',
      title: 'Pathology · Split Maritime Legs (MSC)',
      description:
        'Valid MSC transshipment across Colombo must not trigger missing critical milestone.',
      category: 'data_pathologies',
      stage: 6,
      tags: ['pathology', 'msc', 'transshipment', 'leg-aware'],
      containers: singleContainer('msc'),
      steps: [
        {
          id: 'step-1',
          title: 'Two ACTUAL maritime legs around Colombo',
          description: 'Reload at Colombo opens a new maritime leg before Singapore discharge.',
          snapshots: [
            mscSnapshot({
              containerKey: 'c1',
              fetchedAt: addMinutes(MSC_LEG_AWARE_SINGAPORE_DISCHARGE.eventTime, 45),
              currentDate: toMscDate(addMinutes(MSC_LEG_AWARE_SINGAPORE_DISCHARGE.eventTime, 45)),
              events: [
                MSC_LEG_AWARE_KARACHI_LOAD,
                MSC_LEG_AWARE_COLOMBO_DISCHARGE,
                MSC_LEG_AWARE_COLOMBO_DISCHARGE_DUPLICATE,
                MSC_LEG_AWARE_COLOMBO_POSITIONED_IN,
                MSC_LEG_AWARE_COLOMBO_POSITIONED_OUT,
                MSC_LEG_AWARE_COLOMBO_LOAD,
                MSC_LEG_AWARE_SINGAPORE_DISCHARGE,
              ],
              podEtaDate: toMscDate(atFuture(20, 8)),
              podLocation: buildLocationName(LOC_POD.city, LOC_POD.countryCode),
            }),
          ],
        },
      ],
    }),
    createScenario({
      id: 'carrier_time_travel',
      title: 'Pathology · Carrier Time Travel',
      description: 'Late snapshot introduces older event_time facts.',
      category: 'data_pathologies',
      stage: 5,
      tags: ['pathology', 'out-of-order'],
      containers: singleContainer('maersk'),
      steps: buildProgressiveMaerskSteps('c1', [
        {
          id: 'step-1',
          title: 'Normal progression',
          description: 'Container already departed.',
          newEvents: [EVT_GATE_IN_ACTUAL, EVT_LOAD_ACTUAL, EVT_DEPARTURE_ACTUAL],
        },
        {
          id: 'step-2',
          title: 'Late old event',
          description: 'Old gate-out event appears after departure history.',
          newEvents: [EVT_GATE_OUT_OLDER],
        },
      ]),
    }),
  ]
}

export const SCENARIO_STAGES: readonly ScenarioStageDefinition[] = [
  { stage: 0, label: '0', title: 'Unknown' },
  { stage: 1, label: '1', title: 'Booking' },
  { stage: 2, label: '2', title: 'Pre-Gate' },
  { stage: 3, label: '3', title: 'Gate In' },
  { stage: 4, label: '4', title: 'Loaded' },
  { stage: 5, label: '5', title: 'In Transit' },
  { stage: 6, label: '6', title: 'Transshipment' },
  { stage: 7, label: '7', title: 'Arrived POD' },
  { stage: 8, label: '8', title: 'Discharged' },
  { stage: 9, label: '9', title: 'Delivery' },
  { stage: 10, label: '10', title: 'Empty Return' },
]

const lifecycleScenarios = buildLifecycleScenarios()
const processScenarios = buildProcessAggregationScenarios()
const pathologyScenarios = buildPathologyScenarios()

const allScenarios = [...lifecycleScenarios, ...pathologyScenarios, ...processScenarios]

const scenarioById = new Map<string, TrackingScenario>()
for (const scenario of allScenarios) {
  if (scenarioById.has(scenario.id)) {
    throw new Error(`Duplicate scenario id in catalog: ${scenario.id}`)
  }

  if (scenario.steps.length === 0) {
    throw new Error(`Scenario must contain at least one step: ${scenario.id}`)
  }

  scenarioById.set(scenario.id, scenario)
}

function getLifecycleGroup(stage: ScenarioStage): ScenarioCatalogGroup {
  const stageDef = SCENARIO_STAGES.find((item) => item.stage === stage)
  if (stageDef === undefined) {
    throw new Error(`Missing stage definition: ${stage}`)
  }

  const scenarioIds = lifecycleScenarios
    .filter((scenario) => scenario.stage === stage)
    .map((scenario) => scenario.id)

  return {
    id: `lifecycle.${stage}`,
    title: `${stageDef.label} · ${stageDef.title}`,
    description: `Lifecycle stage ${stageDef.title}`,
    stage,
    scenarioIds,
  }
}

const groups: readonly ScenarioCatalogGroup[] = [
  ...SCENARIO_STAGES.map((item) => getLifecycleGroup(item.stage)),
  {
    id: 'data_pathologies',
    title: 'Data Pathologies',
    description: 'Carrier inconsistencies and bad-data tolerance scenarios.',
    stage: null,
    scenarioIds: pathologyScenarios.map((scenario) => scenario.id),
  },
  {
    id: 'process_aggregation',
    title: 'Process Aggregation',
    description: 'Multi-container scenarios for dashboard/process rollups.',
    stage: null,
    scenarioIds: processScenarios.map((scenario) => scenario.id),
  },
]

const trackingScenarioCatalog: ScenarioCatalog = {
  scenarios: allScenarios,
  groups,
}

export function listTrackingScenarios(): readonly TrackingScenario[] {
  return trackingScenarioCatalog.scenarios
}

export function listTrackingScenarioGroups(): readonly ScenarioCatalogGroup[] {
  return trackingScenarioCatalog.groups
}

export function listTrackingScenarioSummaries(): readonly TrackingScenarioSummary[] {
  return trackingScenarioCatalog.scenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    category: scenario.category,
    stage: scenario.stage,
    tags: scenario.tags,
    stepsCount: scenario.steps.length,
    containersCount: scenario.containers.length,
  }))
}

export function getTrackingScenarioById(id: string): TrackingScenario | null {
  return scenarioById.get(id) ?? null
}
