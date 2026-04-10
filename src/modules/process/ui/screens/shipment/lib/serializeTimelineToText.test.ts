import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  trackingStatusToLabelKey,
  trackingStatusToVariant,
} from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import {
  serializeTimelineToText,
  type TimelineTextExportSource,
  toCurrentTimelineTextExportSource,
  toHistoricalTimelineTextExportSource,
} from '~/modules/process/ui/screens/shipment/lib/serializeTimelineToText'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import type { TimelineRenderItem } from '~/modules/process/ui/timeline/timelineBlockModel'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { createTranslationApi } from '~/shared/localization/i18n'
import { resolveTemporalDto, temporalDtoFromCanonical } from '~/shared/time/tests/helpers'

type TimelineItemOverrides = Omit<Partial<TrackingTimelineItem>, 'eventTime'> &
  Pick<TrackingTimelineItem, 'type'> & {
    readonly eventTime?: string | TrackingTimelineItem['eventTime']
  }

type ContainerOverrides = {
  readonly number?: string
  readonly statusCode?: ContainerDetailVM['statusCode']
  readonly selectedEtaVm?: ContainerDetailVM['selectedEtaVm']
  readonly currentContext?: ContainerDetailVM['currentContext']
  readonly transshipment?: ContainerDetailVM['transshipment']
  readonly timeline?: readonly TrackingTimelineItem[]
}

type SyncOverrides = {
  readonly statusCode?: TrackingTimeTravelSyncVM['statusCode']
  readonly eta?: TrackingTimeTravelSyncVM['eta']
  readonly currentContext?: TrackingTimeTravelSyncVM['currentContext']
  readonly transshipment?: TrackingTimeTravelSyncVM['transshipment']
  readonly timeline?: readonly TrackingTimelineItem[]
}

const translationApi = createTranslationApi({ devMode: false })
const { t, keys, locale } = translationApi
const FIXED_NOW = new Date('2026-04-04T12:00:00.000Z')

let eventCounter = 0

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function defaultCurrentContext(): ContainerDetailVM['currentContext'] {
  return {
    locationCode: 'PKKHI',
    locationDisplay: 'KARACHI-MUHAMMAD BIN QASIM, PK',
    vesselName: 'MSC ARICA',
    voyage: 'OB610R',
    vesselVisible: true,
  }
}

function defaultTransshipment(): ContainerDetailVM['transshipment'] {
  return {
    hasTransshipment: false,
    count: 0,
    ports: [],
  }
}

function defaultTrackingValidation(): ContainerDetailVM['trackingValidation'] {
  return {
    hasIssues: false,
    highestSeverity: null,
    findingCount: 0,
    activeIssues: [],
  }
}

function toEtaChipVm(
  selectedEtaVm: ContainerDetailVM['selectedEtaVm'],
): ContainerDetailVM['etaChipVm'] {
  return {
    state: selectedEtaVm?.state ?? 'UNAVAILABLE',
    tone: selectedEtaVm?.tone ?? 'neutral',
    date: selectedEtaVm?.date ?? null,
  }
}

function toTsChipVm(
  transshipment: ContainerDetailVM['transshipment'],
): ContainerDetailVM['tsChipVm'] {
  return {
    visible: transshipment.count > 0,
    count: transshipment.count,
    portsTooltip: null,
  }
}

function makeEvent(overrides: TimelineItemOverrides): TrackingTimelineItem {
  const { eventTime, ...rest } = overrides

  return {
    id: overrides.id ?? `evt-${String(eventCounter++)}`,
    eventTime: resolveTemporalDto(eventTime, temporalDtoFromCanonical('2026-03-01')),
    eventTimeType: overrides.eventTimeType ?? 'ACTUAL',
    derivedState:
      overrides.derivedState ??
      ((overrides.eventTimeType ?? 'ACTUAL') === 'ACTUAL' ? 'ACTUAL' : 'ACTIVE_EXPECTED'),
    type: overrides.type,
    ...(rest.location === undefined ? {} : { location: rest.location }),
    ...(rest.vesselName === undefined ? {} : { vesselName: rest.vesselName }),
    ...(rest.voyage === undefined ? {} : { voyage: rest.voyage }),
    ...(rest.carrierLabel === undefined ? {} : { carrierLabel: rest.carrierLabel }),
    ...(rest.hasSeriesHistory === undefined ? {} : { hasSeriesHistory: rest.hasSeriesHistory }),
    ...(rest.seriesHistory === undefined ? {} : { seriesHistory: rest.seriesHistory }),
    ...(rest.observationId === undefined ? {} : { observationId: rest.observationId }),
  }
}

function makeContainer(overrides: ContainerOverrides = {}): ContainerDetailVM {
  const statusCode = overrides.statusCode ?? 'IN_TRANSIT'
  const number = overrides.number ?? 'GLDU2928252'
  const selectedEtaVm = overrides.selectedEtaVm ?? null
  const currentContext = overrides.currentContext ?? defaultCurrentContext()
  const transshipment = overrides.transshipment ?? defaultTransshipment()

  return {
    id: 'container-1',
    number,
    carrierCode: 'MSC',
    status: trackingStatusToVariant(statusCode),
    statusCode,
    sync: {
      containerNumber: number,
      carrier: 'MSC',
      state: 'ok',
      relativeTimeAt: null,
      isStale: false,
    },
    eta: selectedEtaVm?.date ?? null,
    etaChipVm: toEtaChipVm(selectedEtaVm),
    selectedEtaVm,
    currentContext,
    nextLocation: null,
    tsChipVm: toTsChipVm(transshipment),
    dataIssueChipVm: {
      visible: false,
    },
    trackingContainment: null,
    trackingValidation: defaultTrackingValidation(),
    transshipment,
    timeline: overrides.timeline ?? [],
  }
}

function makeHistoricalSync(overrides: SyncOverrides = {}): TrackingTimeTravelSyncVM {
  const statusCode = overrides.statusCode ?? 'IN_TRANSIT'

  return {
    snapshotId: 'snapshot-1',
    fetchedAtIso: '2026-04-04T11:00:00.000Z',
    position: 1,
    statusCode,
    statusVariant: trackingStatusToVariant(statusCode),
    timeline: overrides.timeline ?? [],
    alerts: [],
    eta: overrides.eta ?? null,
    currentContext: overrides.currentContext ?? {
      locationCode: 'SGSIN',
      locationDisplay: 'SINGAPORE, SG',
      vesselName: 'SAO PAULO EXPRESS',
      voyage: '2613W',
      vesselVisible: true,
    },
    nextLocation: null,
    transshipment: overrides.transshipment ?? {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    trackingValidation: {
      hasIssues: false,
      highestSeverity: null,
      findingCount: 0,
      activeIssues: [],
    },
    diff: {
      kind: 'initial',
    },
    debugAvailable: false,
  }
}

function makeCurrentSource(container: ContainerDetailVM): TimelineTextExportSource {
  return toCurrentTimelineTextExportSource({
    title: t(keys.shipmentView.timeline.title),
    statusLabel: t(trackingStatusToLabelKey(keys, container.statusCode)),
    container,
  })
}

function makeHistoricalSource(command: {
  readonly containerNumber: string | null
  readonly referenceNowIso: string | null
  readonly sync: TrackingTimeTravelSyncVM
}): TimelineTextExportSource {
  return toHistoricalTimelineTextExportSource({
    title: t(keys.shipmentView.timeline.title),
    containerNumber: command.containerNumber,
    statusLabel: t(trackingStatusToLabelKey(keys, command.sync.statusCode)),
    sync: command.sync,
    referenceNowIso: command.referenceNowIso,
  })
}

function serialize(source: TimelineTextExportSource): string {
  return serializeTimelineToText(source, {
    t,
    keys,
    locale: locale(),
  })
}

it('serializes a simple timeline with pre-carriage, a single voyage and an expected arrival', () => {
  const source = makeCurrentSource(
    makeContainer({
      selectedEtaVm: {
        state: 'ACTIVE_EXPECTED',
        tone: 'informative',
        date: '10/04/2026',
        type: 'ARRIVAL',
      },
      currentContext: {
        locationCode: 'PKKHI',
        locationDisplay: 'KARACHI-MUHAMMAD BIN QASIM, PK',
        vesselName: 'MSC ARICA',
        voyage: 'OB610R',
        vesselVisible: true,
      },
      timeline: [
        makeEvent({
          id: 'pre-gate-out',
          type: 'GATE_OUT',
          eventTime: '2026-04-08',
          location: 'FAISALABAD, PK',
        }),
        makeEvent({
          id: 'voyage-load',
          type: 'LOAD',
          eventTime: '2026-04-09',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'KARACHI-MUHAMMAD BIN QASIM, PK',
        }),
        makeEvent({
          id: 'voyage-arrival',
          type: 'ARRIVAL',
          eventTime: '2026-04-10',
          eventTimeType: 'EXPECTED',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  )

  expect(serialize(source)).toBe(
    [
      '# Timeline do Container',
      'container: GLDU2928252',
      'export_mode: CURRENT',
      'status: Em Trânsito',
      'status_code: IN_TRANSIT',
      'eta: 10/04/2026',
      'eta_state: ACTIVE_EXPECTED',
      'eta_type: ARRIVAL',
      'current_location: KARACHI-MUHAMMAD BIN QASIM, PK',
      'current_vessel: MSC ARICA',
      'current_voyage: OB610R',
      '',
      '## Bloco: Pré-transporte',
      'block_kind: PRE_CARRIAGE',
      'block_title_canonical: Pré-transporte',
      'block_title_display: Pré-transporte',
      'location: FAISALABAD, PK',
      '- label: Saída do Terminal',
      '  type: GATE_OUT',
      '  event_time_type: ACTUAL',
      '  date: 08/04/2026',
      '  location: FAISALABAD, PK',
      '',
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: MSC ARICA',
      'block_badges: Atual',
      'vessel: MSC ARICA',
      'voyage: OB610R',
      'route: KARACHI-MUHAMMAD BIN QASIM, PK → SANTOS, BR',
      '- label: Carregado no Navio',
      '  type: LOAD',
      '  event_time_type: ACTUAL',
      '  date: 09/04/2026',
      '  location: KARACHI-MUHAMMAD BIN QASIM, PK',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
      '- label: Chegada ao Porto',
      '  type: ARRIVAL',
      '  event_time_type: EXPECTED',
      '  date: 10/04/2026',
      '  location: SANTOS, BR',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
    ].join('\n'),
  )
})

it('serializes a real transshipment with voyage, handoff block, terminal block and next voyage', () => {
  const source = makeCurrentSource(
    makeContainer({
      currentContext: {
        locationCode: 'LKCMB',
        locationDisplay: 'COLOMBO, LK',
        vesselName: 'GSL VIOLETTA',
        voyage: '2613W',
        vesselVisible: true,
      },
      transshipment: {
        hasTransshipment: true,
        count: 1,
        ports: [
          {
            code: 'LKCMB',
            display: 'COLOMBO, LK',
          },
        ],
      },
      timeline: [
        makeEvent({
          id: 'voyage-1-load',
          type: 'LOAD',
          eventTime: '2026-04-05',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'KARACHI, PK',
        }),
        makeEvent({
          id: 'voyage-1-discharge',
          type: 'DISCHARGE',
          eventTime: '2026-04-06',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'COLOMBO, LK',
        }),
        makeEvent({
          id: 'terminal-in',
          type: 'TRANSSHIPMENT_POSITIONED_IN',
          eventTime: '2026-04-07',
          location: 'COLOMBO, LK',
        }),
        makeEvent({
          id: 'voyage-2-load',
          type: 'LOAD',
          eventTime: '2026-04-08',
          vesselName: 'GSL VIOLETTA',
          voyage: '2613W',
          location: 'COLOMBO, LK',
        }),
        makeEvent({
          id: 'voyage-2-arrival',
          type: 'ARRIVAL',
          eventTime: '2026-04-09',
          eventTimeType: 'EXPECTED',
          vesselName: 'GSL VIOLETTA',
          voyage: '2613W',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  )

  expect(serialize(source)).toBe(
    [
      '# Timeline do Container',
      'container: GLDU2928252',
      'export_mode: CURRENT',
      'status: Em Trânsito',
      'status_code: IN_TRANSIT',
      'current_location: COLOMBO, LK',
      'current_vessel: GSL VIOLETTA',
      'current_voyage: 2613W',
      'intermediate_ports: COLOMBO, LK',
      '',
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: MSC ARICA',
      'vessel: MSC ARICA',
      'voyage: OB610R',
      'route: KARACHI, PK → COLOMBO, LK',
      '- label: Carregado no Navio',
      '  type: LOAD',
      '  event_time_type: ACTUAL',
      '  date: 05/04/2026',
      '  location: KARACHI, PK',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
      '- label: Descarregado do Navio',
      '  type: DISCHARGE',
      '  event_time_type: ACTUAL',
      '  date: 06/04/2026',
      '  location: COLOMBO, LK',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
      '',
      '## Bloco: Transbordo',
      'block_kind: TRANSSHIPMENT',
      'block_title_canonical: Transbordo',
      'block_title_display: Transbordo',
      'transshipment_mode: CONFIRMED',
      'location: COLOMBO, LK',
      'handoff_summary: MSC ARICA → GSL VIOLETTA',
      'reason: Vessel and voyage change',
      'from_vessel: MSC ARICA',
      'from_voyage: OB610R',
      'to_vessel: GSL VIOLETTA',
      'to_voyage: 2613W',
      '',
      '## Bloco: Terminal de Transbordo',
      'block_kind: TRANSSHIPMENT_TERMINAL',
      'block_title_canonical: Terminal de Transbordo',
      'block_title_display: Terminal de Transbordo',
      'location: COLOMBO, LK',
      '- label: Entrada Operacional no Transbordo',
      '  type: TRANSSHIPMENT_POSITIONED_IN',
      '  event_time_type: ACTUAL',
      '  date: 07/04/2026',
      '  location: COLOMBO, LK',
      '',
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: GSL VIOLETTA',
      'block_badges: Atual',
      'vessel: GSL VIOLETTA',
      'voyage: 2613W',
      'route: COLOMBO, LK → SANTOS, BR',
      '- label: Carregado no Navio',
      '  type: LOAD',
      '  event_time_type: ACTUAL',
      '  date: 08/04/2026',
      '  location: COLOMBO, LK',
      '  vessel: GSL VIOLETTA',
      '  voyage: 2613W',
      '- label: Chegada ao Porto',
      '  type: ARRIVAL',
      '  event_time_type: EXPECTED',
      '  date: 09/04/2026',
      '  location: SANTOS, BR',
      '  vessel: GSL VIOLETTA',
      '  voyage: 2613W',
      '- marker_kind: PORT_RISK',
      '  label: No porto por 2 dias (risco de armazenagem)',
      '  severity: WARNING',
      '  ongoing: true',
      '  duration_days: 2',
    ].join('\n'),
  )
})

it('serializes an explicit planned transshipment block with future leg metadata', () => {
  const source = makeCurrentSource(
    makeContainer({
      currentContext: {
        locationCode: 'LKCMB',
        locationDisplay: 'COLOMBO, LK',
        vesselName: 'MSC ARICA',
        voyage: 'OB610R',
        vesselVisible: true,
      },
      transshipment: {
        hasTransshipment: true,
        count: 1,
        ports: [
          {
            code: 'SGSIN',
            display: 'SINGAPORE, SG',
          },
        ],
      },
      timeline: [
        makeEvent({
          id: 'voyage-1-load',
          type: 'LOAD',
          eventTime: '2026-03-19',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'KARACHI-MUHAMMAD BIN QASIM, PK',
        }),
        makeEvent({
          id: 'voyage-1-discharge',
          type: 'DISCHARGE',
          eventTime: '2026-03-29',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'COLOMBO, LK',
        }),
        makeEvent({
          id: 'planned-ts',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: '2026-03-30',
          eventTimeType: 'EXPECTED',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'voyage-2-departure',
          type: 'DEPARTURE',
          eventTime: '2026-03-31',
          eventTimeType: 'EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'voyage-2-arrival',
          type: 'ARRIVAL',
          eventTime: '2026-04-06',
          eventTimeType: 'EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  )

  expect(serialize(source)).toContain(
    [
      '## Bloco: Transbordo Planejado',
      'block_kind: PLANNED_TRANSSHIPMENT',
      'block_title_canonical: Transbordo Planejado',
      'block_title_display: Transbordo Planejado',
      'transshipment_mode: PLANNED',
      'location: SINGAPORE, SG',
      'handoff_summary: MSC ARICA → SAO PAULO EXPRESS',
      'canonical_type: TRANSSHIPMENT_INTENDED',
      'event_time_type: EXPECTED',
      'date: 30/03/2026',
      'from_vessel: MSC ARICA',
      'from_voyage: OB610R',
      'to_vessel: SAO PAULO EXPRESS',
      'to_voyage: 2613W',
    ].join('\n'),
  )
})

it('preserves heterogeneous block order and serializes visible gap and port-risk markers', () => {
  const source = makeCurrentSource(
    makeContainer({
      timeline: [
        makeEvent({
          id: 'pre-gate-out',
          type: 'GATE_OUT',
          eventTime: '2026-03-01',
          location: 'FAISALABAD, PK',
        }),
        makeEvent({
          id: 'voyage-load',
          type: 'LOAD',
          eventTime: '2026-03-02',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'KARACHI, PK',
        }),
        makeEvent({
          id: 'voyage-arrival',
          type: 'ARRIVAL',
          eventTime: '2026-03-05',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'SANTOS, BR',
        }),
        makeEvent({
          id: 'voyage-discharge',
          type: 'DISCHARGE',
          eventTime: '2026-03-08',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'SANTOS, BR',
        }),
        makeEvent({
          id: 'post-gate-out',
          type: 'GATE_OUT',
          eventTime: '2026-03-09',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  )

  expect(serialize(source)).toContain(
    [
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: MSC ARICA',
      'vessel: MSC ARICA',
      'voyage: OB610R',
      'route: KARACHI, PK → SANTOS, BR',
      '- label: Carregado no Navio',
      '  type: LOAD',
      '  event_time_type: ACTUAL',
      '  date: 02/03/2026',
      '  location: KARACHI, PK',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
      '- marker_kind: GAP',
      '  label: 3 dias em trânsito',
      '  gap_kind: TRANSIT',
      '  duration_days: 3',
      '  from_event_type: LOAD',
      '  to_event_type: ARRIVAL',
      '- label: Chegada ao Porto',
      '  type: ARRIVAL',
      '  event_time_type: ACTUAL',
      '  date: 05/03/2026',
      '  location: SANTOS, BR',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
      '- marker_kind: PORT_RISK',
      '  label: No porto por 3 dias',
      '  severity: WARNING',
      '  ongoing: false',
      '  duration_days: 3',
      '- label: Descarregado do Navio',
      '  type: DISCHARGE',
      '  event_time_type: ACTUAL',
      '  date: 08/03/2026',
      '  location: SANTOS, BR',
      '  vessel: MSC ARICA',
      '  voyage: OB610R',
    ].join('\n'),
  )
})

it('omits optional fields cleanly when vessel, voyage and handoff summary are unavailable', () => {
  const source: TimelineTextExportSource = {
    mode: 'current',
    title: t(keys.shipmentView.timeline.title),
    containerNumber: 'MSCU0000000',
    statusCode: 'IN_PROGRESS',
    statusLabel: t(trackingStatusToLabelKey(keys, 'IN_PROGRESS')),
    eta: null,
    currentContext: {
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: true,
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    referenceNowIso: null,
    renderList: [
      {
        type: 'transshipment-block',
        block: {
          blockType: 'transshipment',
          mode: 'confirmed',
          port: 'COLOMBO, LK',
          reason: null,
          previousVesselName: null,
          previousVoyage: null,
          nextVesselName: null,
          nextVoyage: null,
          handoffDisplayMode: 'NONE',
          events: [],
        },
      },
      {
        type: 'voyage-block',
        block: {
          blockType: 'voyage',
          vessel: null,
          voyage: null,
          origin: null,
          destination: null,
          events: [
            makeEvent({
              id: 'voyage-arrival-missing-fields',
              type: 'ARRIVAL',
              eventTime: '2026-05-06',
              eventTimeType: 'EXPECTED',
              location: 'SANTOS, BR',
            }),
          ],
        },
      },
      {
        type: 'event',
        event: makeEvent({
          id: 'voyage-arrival-missing-fields',
          type: 'ARRIVAL',
          eventTime: '2026-05-06',
          eventTimeType: 'EXPECTED',
          location: 'SANTOS, BR',
        }),
        isLast: true,
      },
      {
        type: 'block-end',
      },
    ],
  }

  expect(serialize(source)).toBe(
    [
      '# Timeline do Container',
      'container: MSCU0000000',
      'export_mode: CURRENT',
      'status: Em Andamento',
      'status_code: IN_PROGRESS',
      '',
      '## Bloco: Transbordo',
      'block_kind: TRANSSHIPMENT',
      'block_title_canonical: Transbordo',
      'block_title_display: Transbordo',
      'transshipment_mode: CONFIRMED',
      'location: COLOMBO, LK',
      '',
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: Viagem',
      'route: ? → SANTOS, BR',
      '- label: Chegada ao Porto',
      '  type: ARRIVAL',
      '  event_time_type: EXPECTED',
      '  date: 06/05/2026',
      '  location: SANTOS, BR',
    ].join('\n'),
  )
})

it('uses the visible historical checkpoint and its reference_now for export', () => {
  const liveSource = makeCurrentSource(
    makeContainer({
      number: 'MSCU1234567',
      statusCode: 'IN_TRANSIT',
      currentContext: {
        locationCode: 'BRSSZ',
        locationDisplay: 'SANTOS, BR',
        vesselName: 'LIVE VESSEL',
        voyage: 'LIVE1',
        vesselVisible: true,
      },
      timeline: [
        makeEvent({
          id: 'live-load',
          type: 'LOAD',
          eventTime: '2026-04-08',
          vesselName: 'LIVE VESSEL',
          voyage: 'LIVE1',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  )
  const historicalSource = makeHistoricalSource({
    containerNumber: 'MSCU1234567',
    referenceNowIso: '2026-04-04T12:00:00.000Z',
    sync: makeHistoricalSync({
      statusCode: 'LOADED',
      eta: {
        date: '12/04/2026',
        state: 'ACTIVE_EXPECTED',
        tone: 'informative',
        type: 'ARRIVAL',
      },
      currentContext: {
        locationCode: 'SGSIN',
        locationDisplay: 'SINGAPORE, SG',
        vesselName: 'SAO PAULO EXPRESS',
        voyage: '2613W',
        vesselVisible: true,
      },
      transshipment: {
        hasTransshipment: true,
        count: 1,
        ports: [
          {
            code: 'SGSIN',
            display: 'Singapore',
          },
        ],
      },
      timeline: [
        makeEvent({
          id: 'historical-load',
          type: 'LOAD',
          eventTime: '2026-04-01',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'historical-arrival',
          type: 'ARRIVAL',
          eventTime: '2026-04-12',
          eventTimeType: 'EXPECTED',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  })

  const liveOutput = serialize(liveSource)
  const historicalOutput = serialize(historicalSource)

  expect(historicalOutput).toBe(
    [
      '# Timeline do Container',
      'container: MSCU1234567',
      'export_mode: HISTORICAL',
      'status: Carregado',
      'status_code: LOADED',
      'eta: 12/04/2026',
      'eta_state: ACTIVE_EXPECTED',
      'eta_type: ARRIVAL',
      'current_location: SINGAPORE, SG',
      'current_vessel: SAO PAULO EXPRESS',
      'current_voyage: 2613W',
      'intermediate_ports: Singapore',
      'reference_now: 2026-04-04T12:00:00.000Z',
      '',
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: SAO PAULO EXPRESS',
      'block_badges: Atual',
      'vessel: SAO PAULO EXPRESS',
      'voyage: 2613W',
      'route: SINGAPORE, SG → SANTOS, BR',
      '- label: Carregado no Navio',
      '  type: LOAD',
      '  event_time_type: ACTUAL',
      '  date: 01/04/2026',
      '  location: SINGAPORE, SG',
      '  vessel: SAO PAULO EXPRESS',
      '  voyage: 2613W',
      '- marker_kind: GAP',
      '  label: 11 dias em trânsito',
      '  gap_kind: TRANSIT',
      '  duration_days: 11',
      '  from_event_type: LOAD',
      '  to_event_type: ARRIVAL',
      '- label: Chegada ao Porto',
      '  type: ARRIVAL',
      '  event_time_type: EXPECTED',
      '  date: 12/04/2026',
      '  location: SANTOS, BR',
      '  vessel: SAO PAULO EXPRESS',
      '  voyage: 2613W',
    ].join('\n'),
  )
  expect(historicalOutput).not.toContain('LIVE VESSEL')
  expect(liveOutput).toContain('LIVE VESSEL')

  const historicalWithoutContainer = serialize(
    makeHistoricalSource({
      containerNumber: null,
      referenceNowIso: '2026-04-04T12:00:00.000Z',
      sync: makeHistoricalSync({
        statusCode: 'LOADED',
        eta: {
          date: '12/04/2026',
          state: 'ACTIVE_EXPECTED',
          tone: 'informative',
          type: 'ARRIVAL',
        },
        currentContext: {
          locationCode: 'SGSIN',
          locationDisplay: 'SINGAPORE, SG',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: '2613W',
          vesselVisible: true,
        },
        transshipment: {
          hasTransshipment: true,
          count: 1,
          ports: [
            {
              code: 'SGSIN',
              display: 'Singapore',
            },
          ],
        },
        timeline: [
          makeEvent({
            id: 'historical-load-no-container',
            type: 'LOAD',
            eventTime: '2026-04-01',
            vesselName: 'SAO PAULO EXPRESS',
            voyage: '2613W',
            location: 'SINGAPORE, SG',
          }),
        ],
      }),
    }),
  )

  expect(historicalWithoutContainer).not.toContain('UNKNOWN')
  expect(historicalWithoutContainer.split('\n')[1]).toBe('export_mode: HISTORICAL')
})

it('keeps planned-block markers under the planned transshipment instead of emitting standalone markers', () => {
  const source = makeCurrentSource(
    makeContainer({
      currentContext: {
        locationCode: 'SGSIN',
        locationDisplay: 'SINGAPORE, SG',
        vesselName: 'MSC MIRAYA V',
        voyage: 'OB612R',
        vesselVisible: true,
      },
      transshipment: {
        hasTransshipment: true,
        count: 1,
        ports: [
          {
            code: 'SGSIN',
            display: 'SINGAPORE, SG',
          },
        ],
      },
      timeline: [
        makeEvent({
          id: 'leg-a-load',
          type: 'LOAD',
          eventTime: '2026-03-01',
          vesselName: 'MSC MIRAYA V',
          voyage: 'OB612R',
          location: 'KARACHI, PK',
        }),
        makeEvent({
          id: 'leg-a-discharge',
          type: 'DISCHARGE',
          eventTime: '2026-03-11',
          vesselName: 'MSC MIRAYA V',
          voyage: 'OB612R',
          location: 'SINGAPORE, SG',
        }),
        makeEvent({
          id: 'planned-intended',
          type: 'TRANSSHIPMENT_INTENDED',
          eventTime: '2026-03-12',
          eventTimeType: 'EXPECTED',
          location: 'SINGAPORE, SG',
          vesselName: 'SAO PAULO EXPRESS',
          voyage: 'SPX001',
        }),
        makeEvent({
          id: 'planned-arrival',
          type: 'ARRIVAL',
          eventTime: '2026-04-10',
          eventTimeType: 'EXPECTED',
          location: 'SANTOS, BR',
        }),
        makeEvent({
          id: 'planned-discharge',
          type: 'DISCHARGE',
          eventTime: '2026-04-12',
          eventTimeType: 'EXPECTED',
          location: 'SANTOS, BR',
        }),
      ],
    }),
  )

  const output = serialize(source)

  expect(output).toContain(
    [
      '## Bloco: Transbordo Planejado',
      'block_kind: PLANNED_TRANSSHIPMENT',
      'block_title_canonical: Transbordo Planejado',
      'block_title_display: Transbordo Planejado',
      'transshipment_mode: PLANNED',
      'location: SINGAPORE, SG',
      'handoff_summary: MSC MIRAYA V → SAO PAULO EXPRESS',
      'canonical_type: TRANSSHIPMENT_INTENDED',
      'event_time_type: EXPECTED',
      'date: 12/03/2026',
      'from_vessel: MSC MIRAYA V',
      'from_voyage: OB612R',
      'to_vessel: SAO PAULO EXPRESS',
      'to_voyage: SPX001',
      '- marker_kind: GAP',
      '  label: Intervalo: 29 dias sem novos eventos',
      '  gap_kind: GENERIC',
      '  duration_days: 29',
      '  from_event_type: TRANSSHIPMENT_INTENDED',
      '  to_event_type: ARRIVAL',
    ].join('\n'),
  )
  expect(output).not.toContain('block_kind: TIMELINE_MARKERS')
})

it('preserves real voyage discrepancies between block header metadata and child events without inventing a fake alignment', () => {
  const source = makeCurrentSource(
    makeContainer({
      timeline: [
        makeEvent({
          id: 'voyage-load',
          type: 'LOAD',
          eventTime: '2026-03-19',
          vesselName: 'MSC ARICA',
          voyage: 'OB610R',
          location: 'KARACHI-MUHAMMAD BIN QASIM, PK',
        }),
        makeEvent({
          id: 'voyage-discharge',
          type: 'DISCHARGE',
          eventTime: '2026-03-28',
          vesselName: 'MSC ARICA',
          voyage: 'IV610A',
          location: 'COLOMBO, LK',
        }),
      ],
    }),
  )

  const output = serialize(source)

  expect(output).toContain(
    [
      '## Bloco: Viagem',
      'block_kind: VOYAGE',
      'block_title_canonical: Viagem',
      'block_title_display: MSC ARICA',
      'block_badges: Atual',
      'vessel: MSC ARICA',
      'voyage: OB610R',
      'route: KARACHI-MUHAMMAD BIN QASIM, PK → COLOMBO, LK',
    ].join('\n'),
  )
  expect(output).toContain(
    [
      '- label: Descarregado do Navio',
      '  type: DISCHARGE',
      '  event_time_type: ACTUAL',
      '  date: 28/03/2026',
      '  location: COLOMBO, LK',
      '  vessel: MSC ARICA',
      '  voyage: IV610A',
    ].join('\n'),
  )
  expect(output).not.toContain('block_kind: TIMELINE_MARKERS')
})

it('keeps the current voyage badge aligned when standalone markers appear between voyages', () => {
  const source: TimelineTextExportSource = {
    mode: 'current',
    title: t(keys.shipmentView.timeline.title),
    containerNumber: 'GLDU2928252',
    statusCode: 'IN_TRANSIT',
    statusLabel: t(trackingStatusToLabelKey(keys, 'IN_TRANSIT')),
    eta: null,
    currentContext: {
      locationDisplay: 'SINGAPORE, SG',
      vesselName: 'GSL VIOLETTA',
      voyage: '2613W',
      vesselVisible: true,
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    referenceNowIso: null,
    renderList: [
      {
        type: 'voyage-block',
        block: {
          blockType: 'voyage',
          vessel: 'MSC ARICA',
          voyage: 'OB610R',
          origin: 'KARACHI, PK',
          destination: 'COLOMBO, LK',
          events: [
            makeEvent({
              id: 'voyage-1-load',
              type: 'LOAD',
              eventTime: '2026-04-05',
              vesselName: 'MSC ARICA',
              voyage: 'OB610R',
              location: 'KARACHI, PK',
            }),
            makeEvent({
              id: 'voyage-1-discharge',
              type: 'DISCHARGE',
              eventTime: '2026-04-06',
              vesselName: 'MSC ARICA',
              voyage: 'OB610R',
              location: 'COLOMBO, LK',
            }),
          ],
        },
      },
      {
        type: 'block-end',
      },
      {
        type: 'gap-marker',
        marker: {
          blockType: 'gap-marker',
          kind: 'generic',
          durationDays: 2,
          fromEventType: 'DISCHARGE',
          toEventType: 'LOAD',
        },
      },
      {
        type: 'port-risk-marker',
        marker: {
          blockType: 'port-risk-marker',
          durationDays: 3,
          ongoing: false,
          severity: 'warning',
        },
      },
      {
        type: 'voyage-block',
        block: {
          blockType: 'voyage',
          vessel: 'GSL VIOLETTA',
          voyage: '2613W',
          origin: 'SINGAPORE, SG',
          destination: 'SANTOS, BR',
          events: [
            makeEvent({
              id: 'voyage-2-load',
              type: 'LOAD',
              eventTime: '2026-04-08',
              vesselName: 'GSL VIOLETTA',
              voyage: '2613W',
              location: 'SINGAPORE, SG',
            }),
            makeEvent({
              id: 'voyage-2-departure',
              type: 'DEPARTURE',
              eventTime: '2026-04-09',
              vesselName: 'GSL VIOLETTA',
              voyage: '2613W',
              location: 'SINGAPORE, SG',
            }),
          ],
        },
      },
      {
        type: 'block-end',
      },
    ] satisfies readonly TimelineRenderItem[],
  }

  const output = serialize(source)

  expect(output).toContain('block_title_display: GSL VIOLETTA\nblock_badges: Atual')
  expect(output).not.toContain('block_title_display: MSC ARICA\nblock_badges: Atual')
  expect(output).toContain('block_kind: TIMELINE_MARKERS')
  expect(output).toContain('label: Intervalo: 2 dias sem novos eventos')
  expect(output).toContain('label: No porto por 3 dias')
})

it('uses a readable timeline markers fallback only when markers are truly standalone', () => {
  const source: TimelineTextExportSource = {
    mode: 'current',
    title: t(keys.shipmentView.timeline.title),
    containerNumber: 'MSCU9999999',
    statusCode: 'IN_PROGRESS',
    statusLabel: t(trackingStatusToLabelKey(keys, 'IN_PROGRESS')),
    eta: null,
    currentContext: {
      locationDisplay: null,
      vesselName: null,
      voyage: null,
      vesselVisible: true,
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    referenceNowIso: null,
    renderList: [
      {
        type: 'gap-marker',
        marker: {
          blockType: 'gap-marker',
          kind: 'generic',
          durationDays: 4,
          fromEventType: 'GATE_IN',
          toEventType: 'GATE_OUT',
        },
      },
    ],
  }

  expect(serialize(source)).toContain(
    [
      '## Bloco: Marcadores',
      'block_kind: TIMELINE_MARKERS',
      'block_title_canonical: Marcadores',
      'block_title_display: Marcadores',
      '- marker_kind: GAP',
      '  label: Intervalo: 4 dias sem novos eventos',
    ].join('\n'),
  )
})
