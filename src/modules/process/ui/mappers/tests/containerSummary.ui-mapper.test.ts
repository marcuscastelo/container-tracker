import { describe, expect, it } from 'vitest'
import { toContainerSummaryRowVMs } from '~/modules/process/ui/mappers/containerSummary.ui-mapper'
import { formatRelativeTime } from '~/modules/process/ui/utils/formatRelativeTime'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Instant } from '~/shared/time/instant'
import { parseInstantFromIso } from '~/shared/time/parsing'

type ContainerOverrides = {
  readonly number?: string
  readonly status?: ContainerDetailVM['status']
  readonly statusCode?: ContainerDetailVM['statusCode']
  readonly relativeTimeAt?: string | null
  readonly etaChipVm?: ContainerDetailVM['etaChipVm']
}

function makeContainer(overrides: ContainerOverrides = {}): ContainerDetailVM {
  const number = overrides.number ?? 'MSCU1234567'
  const relativeTimeAt =
    overrides.relativeTimeAt === undefined ? '2026-03-07T09:59:00.000Z' : overrides.relativeTimeAt

  return {
    id: `container-${number}`,
    number,
    carrierCode: 'msc',
    status: overrides.status ?? 'in-transit',
    statusCode: overrides.statusCode ?? 'IN_TRANSIT',
    sync: {
      containerNumber: number,
      carrier: 'msc',
      state: 'ok',
      relativeTimeAt,
      isStale: false,
    },
    eta: null,
    etaChipVm: overrides.etaChipVm ?? {
      state: 'ACTIVE_EXPECTED',
      tone: 'informative',
      date: '2026-03-10',
    },
    selectedEtaVm: null,
    tsChipVm: {
      visible: false,
      count: 0,
      portsTooltip: null,
    },
    dataIssueChipVm: {
      visible: false,
    },
    transshipment: {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    timeline: [],
  }
}

function makeMapperCommand(containers: readonly ContainerDetailVM[]) {
  const { keys } = useTranslation()
  const now = Instant.fromIso('2026-03-07T10:00:00.000Z')
  const locale = 'en-US'

  return {
    containers,
    now,
    locale,
    keys,
    t: (key: string): string => {
      if (key === keys.shipmentView.operational.chips.etaArrived) return 'Arrived'
      if (key === keys.shipmentView.operational.chips.etaExpected) return 'ETA'
      if (key === keys.shipmentView.operational.chips.etaDelayedSuffix) return 'delayed'
      if (key === keys.tracking.status.DISCHARGED) return 'Discharged'
      if (key === keys.tracking.status.IN_TRANSIT) return 'In transit'
      return `tx:${key}`
    },
    noEtaLabel: 'ETA —',
    updatedLabel: (relative: string) => `updated ${relative}`,
  }
}

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`)
  }
  return item
}

describe('toContainerSummaryRowVMs', () => {
  it('maps status label from tracking status key', () => {
    const container = makeContainer({
      status: 'orange-500',
      statusCode: 'DISCHARGED',
    })
    const command = makeMapperCommand([container])
    const [row] = toContainerSummaryRowVMs(command)
    if (!row) throw new Error('Expected row at index 0')

    expect(row.statusVariant).toBe('orange-500')
    expect(row.statusLabel).toBe(command.t(command.keys.tracking.status.DISCHARGED))
  })

  it('maps ETA label using eta chip semantics', () => {
    const delayed = makeContainer({
      number: 'MSCU7654321',
      etaChipVm: {
        state: 'EXPIRED_EXPECTED',
        tone: 'warning',
        date: '2026-03-10',
      },
    })
    const unavailable = makeContainer({
      number: 'MSCU2222222',
      etaChipVm: {
        state: 'UNAVAILABLE',
        tone: 'neutral',
        date: null,
      },
    })
    const rows = toContainerSummaryRowVMs(makeMapperCommand([delayed, unavailable]))
    const delayedRow = requireAt(rows, 0)
    const unavailableRow = requireAt(rows, 1)

    expect(delayedRow.etaLabel).toBe('ETA 2026-03-10 · delayed')
    expect(unavailableRow.etaLabel).toBe('ETA —')
  })

  it('formats updatedAgoLabel from relative time and keeps null when missing', () => {
    const withSyncTime = makeContainer({
      number: 'MSCU1111111',
      relativeTimeAt: '2026-03-07T09:59:00.000Z',
    })
    const withoutSyncTime = makeContainer({
      number: 'MSCU9999999',
      relativeTimeAt: null,
    })
    const command = makeMapperCommand([withSyncTime, withoutSyncTime])
    const rows = toContainerSummaryRowVMs(command)
    const withSyncRow = requireAt(rows, 0)
    const withoutSyncRow = requireAt(rows, 1)

    const expectedRelative = formatRelativeTime(
      parseInstantFromIso(withSyncTime.sync.relativeTimeAt ?? '') ?? command.now,
      command.now,
      command.locale,
    )

    expect(withSyncRow.updatedAgoLabel).toBe(command.updatedLabel(expectedRelative))
    expect(withoutSyncRow.updatedAgoLabel).toBeNull()
  })
})
