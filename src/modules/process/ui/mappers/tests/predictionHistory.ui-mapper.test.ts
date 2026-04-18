import { describe, expect, it } from 'vitest'
import { toPredictionHistoryModalVM } from '~/modules/process/ui/mappers/predictionHistory.ui-mapper'
import type {
  PredictionHistorySource,
  PredictionHistoryVersionSource,
} from '~/modules/process/ui/viewmodels/prediction-history.vm'
import { useTranslation } from '~/shared/localization/i18n'

function makeVersion(
  overrides: Partial<PredictionHistoryVersionSource> = {},
): PredictionHistoryVersionSource {
  return {
    id: overrides.id ?? 'version-1',
    isCurrent: overrides.isCurrent ?? false,
    type: overrides.type ?? 'ARRIVAL',
    eventTime: overrides.eventTime ?? { kind: 'date', value: '2026-05-10', timezone: null },
    eventTimeType: overrides.eventTimeType ?? 'EXPECTED',
    vesselName: overrides.vesselName ?? null,
    voyage: overrides.voyage ?? null,
    versionState: overrides.versionState ?? 'ESTIMATE_CHANGED',
    explanatoryTextKind: overrides.explanatoryTextKind ?? null,
    transitionKindFromPreviousVersion: overrides.transitionKindFromPreviousVersion ?? null,
    observedAtCount: overrides.observedAtCount ?? 1,
    observedAtList: overrides.observedAtList ?? ['2026-04-01T12:00:00.000Z'],
    firstObservedAt: overrides.firstObservedAt ?? '2026-04-01T12:00:00.000Z',
    lastObservedAt: overrides.lastObservedAt ?? '2026-04-01T12:00:00.000Z',
  }
}

function makeSource(overrides: Partial<PredictionHistorySource> = {}): PredictionHistorySource {
  return {
    header: overrides.header ?? {
      tone: 'neutral',
      summaryKind: 'HISTORY_UPDATED',
      currentVersionId: 'current-version',
      previousVersionId: null,
      originalVersionId: 'original-version',
      reasonKind: 'ESTIMATE_CHANGED',
    },
    versions: overrides.versions ?? [
      makeVersion({
        id: 'current-version',
        isCurrent: true,
        eventTime: { kind: 'date', value: '2026-05-11', timezone: null },
        eventTimeType: 'ACTUAL',
        versionState: 'CONFIRMED',
        transitionKindFromPreviousVersion: 'EVENT_CONFIRMED',
        observedAtList: ['2026-04-04T12:00:00.000Z'],
        firstObservedAt: '2026-04-04T12:00:00.000Z',
        lastObservedAt: '2026-04-04T12:00:00.000Z',
      }),
      makeVersion({
        id: 'original-version',
        eventTime: { kind: 'date', value: '2026-05-10', timezone: null },
        versionState: 'INITIAL',
        observedAtList: ['2026-04-01T12:00:00.000Z'],
        firstObservedAt: '2026-04-01T12:00:00.000Z',
        lastObservedAt: '2026-04-01T12:00:00.000Z',
      }),
    ],
  }
}

describe('predictionHistory.ui-mapper', () => {
  it('formats tooltip lines for one, two and three-or-more observations', () => {
    const { t, keys, locale } = useTranslation()
    const vm = toPredictionHistoryModalVM({
      source: makeSource({
        header: {
          tone: 'neutral',
          summaryKind: 'HISTORY_UPDATED',
          currentVersionId: 'one',
          previousVersionId: null,
          originalVersionId: 'three',
          reasonKind: 'ESTIMATE_CHANGED',
        },
        versions: [
          makeVersion({
            id: 'one',
            isCurrent: true,
            eventTime: { kind: 'date', value: '2026-05-11', timezone: null },
            eventTimeType: 'ACTUAL',
            versionState: 'CONFIRMED',
            transitionKindFromPreviousVersion: 'EVENT_CONFIRMED',
            observedAtList: ['2026-04-04T12:00:00.000Z'],
            firstObservedAt: '2026-04-04T12:00:00.000Z',
            lastObservedAt: '2026-04-04T12:00:00.000Z',
          }),
          makeVersion({
            id: 'two',
            eventTime: { kind: 'date', value: '2026-05-10', timezone: null },
            observedAtCount: 2,
            observedAtList: ['2026-04-02T12:00:00.000Z', '2026-04-03T12:00:00.000Z'],
            firstObservedAt: '2026-04-02T12:00:00.000Z',
            lastObservedAt: '2026-04-03T12:00:00.000Z',
          }),
          makeVersion({
            id: 'three',
            eventTime: { kind: 'date', value: '2026-05-09', timezone: null },
            versionState: 'INITIAL',
            observedAtCount: 3,
            observedAtList: [
              '2026-04-01T12:00:00.000Z',
              '2026-04-05T12:00:00.000Z',
              '2026-04-06T12:00:00.000Z',
            ],
            firstObservedAt: '2026-04-01T12:00:00.000Z',
            lastObservedAt: '2026-04-06T12:00:00.000Z',
          }),
        ],
      }),
      activityLabel: 'Chegada',
      locale: locale(),
      t,
      keys,
    })

    expect(vm.items[0]?.infoTooltipLines).toEqual(['Observado em 04/04/2026'])
    expect(vm.items[1]?.infoTooltipLines).toEqual([
      'Observado em 02/04/2026',
      'Observado em 03/04/2026',
    ])
    expect(vm.items[2]?.infoTooltipLines).toEqual(['Observado de 01/04/2026 até 06/04/2026'])
  })

  it('builds the conflict header and renders the previous conflicting fact as confirmed before', () => {
    const { t, keys, locale } = useTranslation()

    const vm = toPredictionHistoryModalVM({
      source: makeSource({
        header: {
          tone: 'danger',
          summaryKind: 'CONFLICT_DETECTED',
          currentVersionId: 'voyage-current',
          previousVersionId: 'voyage-old',
          originalVersionId: null,
          reasonKind: 'VOYAGE_CHANGED_AFTER_CONFIRMATION',
        },
        versions: [
          makeVersion({
            id: 'voyage-current',
            isCurrent: true,
            eventTime: { kind: 'date', value: '2026-03-28', timezone: null },
            eventTimeType: 'ACTUAL',
            vesselName: 'MSC ARICA',
            voyage: 'OB610R',
            versionState: 'CONFIRMED',
            transitionKindFromPreviousVersion: 'VOYAGE_CHANGED_AFTER_CONFIRMATION',
            observedAtList: ['2026-04-04T12:00:00.000Z'],
            firstObservedAt: '2026-04-04T12:00:00.000Z',
            lastObservedAt: '2026-04-04T12:00:00.000Z',
          }),
          makeVersion({
            id: 'voyage-old',
            eventTime: { kind: 'date', value: '2026-03-28', timezone: null },
            eventTimeType: 'ACTUAL',
            vesselName: 'MSC ARICA',
            voyage: 'IV610A',
            versionState: 'CONFIRMED_BEFORE',
            explanatoryTextKind: 'REPORTED_AS_ACTUAL_AND_CORRECTED_LATER',
            observedAtList: ['2026-04-02T12:00:00.000Z'],
            firstObservedAt: '2026-04-02T12:00:00.000Z',
            lastObservedAt: '2026-04-02T12:00:00.000Z',
          }),
        ],
      }),
      activityLabel: 'Descarregado do Navio',
      locale: locale(),
      t,
      keys,
    })

    expect(vm.header).toEqual({
      tone: 'danger',
      summaryLabel: 'Conflito detectado',
      currentLine: 'Atual: MSC ARICA / OB610R',
      comparisonLine: 'Antes: MSC ARICA / IV610A',
      reasonLine: 'Motivo: troca de viagem após confirmação',
    })
    expect(vm.items[0]?.stateLabel).toBe('Confirmado')
    expect(vm.items[0]?.currentMarkerLabel).toBe('Versão atual')
    expect(vm.items[0]?.mainDateLabel).toBe('28/03/2026')
    expect(vm.items[1]?.stateLabel).toBe('Confirmado antes')
    expect(vm.items[1]?.explanatoryText).toBe('Informado como real pelo armador e corrigido depois')
  })

  it('groups display-equivalent versions, keeps the current item first and uses estimate changed copy', () => {
    const { t, keys, locale } = useTranslation()

    const vm = toPredictionHistoryModalVM({
      source: makeSource({
        header: {
          tone: 'neutral',
          summaryKind: 'HISTORY_UPDATED',
          currentVersionId: 'current-version',
          previousVersionId: null,
          originalVersionId: 'original-version',
          reasonKind: 'ESTIMATE_CHANGED',
        },
        versions: [
          makeVersion({
            id: 'current-version',
            isCurrent: true,
            eventTime: { kind: 'date', value: '2026-05-11', timezone: null },
            eventTimeType: 'ACTUAL',
            versionState: 'CONFIRMED',
            transitionKindFromPreviousVersion: 'EVENT_CONFIRMED',
            observedAtList: ['2026-04-04T12:00:00.000Z'],
            firstObservedAt: '2026-04-04T12:00:00.000Z',
            lastObservedAt: '2026-04-04T12:00:00.000Z',
          }),
          makeVersion({
            id: 'dup-1',
            eventTime: { kind: 'date', value: '2026-05-10', timezone: null },
            versionState: 'ESTIMATE_CHANGED',
            transitionKindFromPreviousVersion: 'ESTIMATE_CHANGED',
            observedAtList: ['2026-04-02T12:00:00.000Z'],
            firstObservedAt: '2026-04-02T12:00:00.000Z',
            lastObservedAt: '2026-04-02T12:00:00.000Z',
          }),
          makeVersion({
            id: 'dup-2',
            eventTime: { kind: 'date', value: '2026-05-10', timezone: null },
            versionState: 'ESTIMATE_CHANGED',
            transitionKindFromPreviousVersion: 'ESTIMATE_CHANGED',
            observedAtList: ['2026-04-03T12:00:00.000Z'],
            firstObservedAt: '2026-04-03T12:00:00.000Z',
            lastObservedAt: '2026-04-03T12:00:00.000Z',
          }),
          makeVersion({
            id: 'original-version',
            eventTime: { kind: 'date', value: '2026-05-08', timezone: null },
            versionState: 'INITIAL',
            observedAtList: ['2026-04-01T12:00:00.000Z'],
            firstObservedAt: '2026-04-01T12:00:00.000Z',
            lastObservedAt: '2026-04-01T12:00:00.000Z',
          }),
        ],
      }),
      activityLabel: 'Chegada',
      locale: locale(),
      t,
      keys,
    })

    expect(vm.header).toEqual({
      tone: 'neutral',
      summaryLabel: 'Histórico atualizado',
      currentLine: 'Atual: 11/05/2026',
      comparisonLine: 'Original: 08/05/2026',
      reasonLine: 'Motivo: estimativa alterada',
    })
    expect(vm.items).toHaveLength(3)
    expect(vm.items[0]?.isCurrent).toBe(true)
    expect(vm.items[1]?.stateLabel).toBe('Estimativa alterada')
    expect(vm.items[1]?.infoTooltipLines).toEqual([
      'Observado em 02/04/2026',
      'Observado em 03/04/2026',
    ])
    expect(vm.items.map((item) => item.stateLabel)).toEqual([
      'Confirmado',
      'Estimativa alterada',
      'Primeira versão',
    ])
  })
})
