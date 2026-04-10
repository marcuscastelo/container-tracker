import {
  groupPredictionHistoryDisplayCandidates,
  type PredictionHistoryDisplayCandidate,
} from '~/modules/process/ui/utils/predictionHistoryDisplay.utils'
import type {
  PredictionHistoryHeaderTone,
  PredictionHistoryItemTone,
  PredictionHistoryModalVM,
} from '~/modules/process/ui/viewmodels/prediction-history.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import type { TemporalValueDto } from '~/shared/time/dto'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type TranslateFn = (key: string, options?: Record<string, unknown>) => string

export type PredictionHistorySource = {
  readonly header: {
    readonly tone: 'danger' | 'warning' | 'neutral'
    readonly summaryKind: 'SINGLE_VERSION' | 'HISTORY_UPDATED' | 'CONFLICT_DETECTED'
    readonly currentVersionId: string
    readonly previousVersionId: string | null
    readonly originalVersionId: string | null
    readonly reasonKind:
      | 'EVENT_CONFIRMED'
      | 'ESTIMATE_CHANGED'
      | 'PREVIOUS_VERSION_SUBSTITUTED'
      | 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
      | null
  }
  readonly versions: readonly PredictionHistoryVersionSource[]
}

export type PredictionHistoryVersionSource = {
  readonly id: string
  readonly isCurrent: boolean
  readonly type: string
  readonly eventTime: TemporalValueDto | null
  readonly eventTimeType: 'ACTUAL' | 'EXPECTED'
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly versionState:
    | 'CONFIRMED'
    | 'CONFIRMED_BEFORE'
    | 'SUBSTITUTED'
    | 'ESTIMATE_CHANGED'
    | 'INITIAL'
  readonly explanatoryTextKind: 'REPORTED_AS_ACTUAL_AND_CORRECTED_LATER' | null
  readonly transitionKindFromPreviousVersion:
    | 'EVENT_CONFIRMED'
    | 'ESTIMATE_CHANGED'
    | 'PREVIOUS_VERSION_SUBSTITUTED'
    | 'VOYAGE_CHANGED_AFTER_CONFIRMATION'
    | null
  readonly observedAtCount: number
  readonly observedAtList: readonly string[]
  readonly firstObservedAt: string
  readonly lastObservedAt: string
}

type DisplayLabels = {
  readonly primaryLabel: string
  readonly secondaryLabel: string | null
  readonly mainDateLabel: string | null
}

function formatVoyageLabel(version: PredictionHistoryVersionSource): string | null {
  const vesselName = version.vesselName?.trim() ?? ''
  const voyage = version.voyage?.trim() ?? ''

  if (vesselName.length > 0 && voyage.length > 0) {
    return `${vesselName} / ${voyage}`
  }

  if (vesselName.length > 0) return vesselName
  if (voyage.length > 0) return voyage
  return null
}

function resolveStateTone(
  state: PredictionHistoryVersionSource['versionState'],
): PredictionHistoryItemTone {
  switch (state) {
    case 'CONFIRMED':
      return 'success'
    case 'CONFIRMED_BEFORE':
      return 'warning'
    case 'SUBSTITUTED':
      return 'neutral'
    case 'ESTIMATE_CHANGED':
      return 'info'
    case 'INITIAL':
      return 'neutral'
  }
}

function resolveHeaderTone(
  tone: PredictionHistorySource['header']['tone'],
): PredictionHistoryHeaderTone {
  return tone
}

function versionStateLabel(
  state: PredictionHistoryVersionSource['versionState'],
  t: TranslateFn,
  keys: TranslationKeys,
): string {
  switch (state) {
    case 'CONFIRMED':
      return t(keys.shipmentView.timeline.predictionHistory.versionStates.confirmed)
    case 'CONFIRMED_BEFORE':
      return t(keys.shipmentView.timeline.predictionHistory.versionStates.confirmedBefore)
    case 'SUBSTITUTED':
      return t(keys.shipmentView.timeline.predictionHistory.versionStates.substituted)
    case 'ESTIMATE_CHANGED':
      return t(keys.shipmentView.timeline.predictionHistory.versionStates.estimateChanged)
    case 'INITIAL':
      return t(keys.shipmentView.timeline.predictionHistory.versionStates.initial)
  }
}

function explanatoryTextLabel(
  explanatoryTextKind: PredictionHistoryVersionSource['explanatoryTextKind'],
  t: TranslateFn,
  keys: TranslationKeys,
): string | null {
  if (explanatoryTextKind === null) return null

  return t(keys.shipmentView.timeline.predictionHistory.explanatoryText.actualCorrectedLater)
}

function transitionLabel(
  transitionKind: PredictionHistoryVersionSource['transitionKindFromPreviousVersion'],
  t: TranslateFn,
  keys: TranslationKeys,
): string | null {
  if (transitionKind === null) return null

  switch (transitionKind) {
    case 'EVENT_CONFIRMED':
      return t(keys.shipmentView.timeline.predictionHistory.transitions.eventConfirmed)
    case 'ESTIMATE_CHANGED':
      return t(keys.shipmentView.timeline.predictionHistory.transitions.estimateChanged)
    case 'PREVIOUS_VERSION_SUBSTITUTED':
      return t(keys.shipmentView.timeline.predictionHistory.transitions.previousVersionSubstituted)
    case 'VOYAGE_CHANGED_AFTER_CONFIRMATION':
      return t(
        keys.shipmentView.timeline.predictionHistory.transitions.voyageChangedAfterConfirmation,
      )
  }
}

function headerSummaryLabel(
  summaryKind: PredictionHistorySource['header']['summaryKind'],
  t: TranslateFn,
  keys: TranslationKeys,
): string {
  switch (summaryKind) {
    case 'SINGLE_VERSION':
      return t(keys.shipmentView.timeline.predictionHistory.header.singleVersion)
    case 'HISTORY_UPDATED':
      return t(keys.shipmentView.timeline.predictionHistory.header.historyUpdated)
    case 'CONFLICT_DETECTED':
      return t(keys.shipmentView.timeline.predictionHistory.header.conflictDetected)
  }
}

function buildTooltipLines(command: {
  readonly observedAtList: readonly string[]
  readonly locale: string
  readonly t: TranslateFn
  readonly keys: TranslationKeys
}): readonly string[] {
  if (command.observedAtList.length === 0) {
    return []
  }

  if (command.observedAtList.length === 1) {
    const observedAt = command.observedAtList[0]
    if (observedAt === undefined) {
      return []
    }

    return [
      command.t(command.keys.shipmentView.timeline.predictionHistory.tooltip.observedAt, {
        date: formatDateForLocale(observedAt, command.locale),
      }),
    ]
  }

  if (command.observedAtList.length === 2) {
    return command.observedAtList.map((observedAt) =>
      command.t(command.keys.shipmentView.timeline.predictionHistory.tooltip.observedAt, {
        date: formatDateForLocale(observedAt, command.locale),
      }),
    )
  }

  const firstObservedAt = command.observedAtList[0]
  const lastObservedAt = command.observedAtList[command.observedAtList.length - 1]

  if (firstObservedAt === undefined || lastObservedAt === undefined) {
    return []
  }

  return [
    command.t(command.keys.shipmentView.timeline.predictionHistory.tooltip.observedRange, {
      start: formatDateForLocale(firstObservedAt, command.locale),
      end: formatDateForLocale(lastObservedAt, command.locale),
    }),
  ]
}

function resolveVersionDisplayLabels(command: {
  readonly version: PredictionHistoryVersionSource
  readonly locale: string
  readonly t: TranslateFn
  readonly keys: TranslationKeys
}): DisplayLabels {
  const dateLabel =
    command.version.eventTime === null
      ? null
      : formatDateForLocale(command.version.eventTime, command.locale)
  const voyageLabel = formatVoyageLabel(command.version)
  const unavailable = command.t(command.keys.shipmentView.timeline.predictionHistory.unavailable)

  if (voyageLabel !== null) {
    return {
      primaryLabel: voyageLabel,
      secondaryLabel: null,
      mainDateLabel: dateLabel,
    }
  }

  if (dateLabel !== null) {
    return {
      primaryLabel: dateLabel,
      secondaryLabel: null,
      mainDateLabel: null,
    }
  }

  return {
    primaryLabel: unavailable,
    secondaryLabel: null,
    mainDateLabel: null,
  }
}

function toDisplayCandidate(command: {
  readonly version: PredictionHistoryVersionSource
  readonly activityLabel: string
  readonly locale: string
  readonly t: TranslateFn
  readonly keys: TranslationKeys
}): PredictionHistoryDisplayCandidate {
  const labels = resolveVersionDisplayLabels({
    version: command.version,
    locale: command.locale,
    t: command.t,
    keys: command.keys,
  })

  return {
    id: command.version.id,
    rawIds: [command.version.id],
    isCurrent: command.version.isCurrent,
    currentMarkerLabel: command.version.isCurrent
      ? command.t(command.keys.shipmentView.timeline.predictionHistory.currentVersionMarker)
      : null,
    title: command.activityLabel,
    primaryLabel: labels.primaryLabel,
    secondaryLabel: labels.secondaryLabel,
    mainDateLabel: labels.mainDateLabel,
    stateLabel: versionStateLabel(command.version.versionState, command.t, command.keys),
    stateTone: resolveStateTone(command.version.versionState),
    explanatoryText: explanatoryTextLabel(
      command.version.explanatoryTextKind,
      command.t,
      command.keys,
    ),
    transitionLabelFromPrevious: transitionLabel(
      command.version.transitionKindFromPreviousVersion,
      command.t,
      command.keys,
    ),
    observedAtList: [...command.version.observedAtList].sort((left, right) =>
      left.localeCompare(right),
    ),
  }
}

function findGroupedVersion(
  items: readonly PredictionHistoryDisplayCandidate[],
  rawId: string | null,
): PredictionHistoryDisplayCandidate | null {
  if (rawId === null) return null

  return items.find((item) => item.rawIds.includes(rawId)) ?? null
}

export function toPredictionHistoryModalVM(command: {
  readonly source: PredictionHistorySource
  readonly activityLabel: string
  readonly locale: string
  readonly t: TranslateFn
  readonly keys: TranslationKeys
}): PredictionHistoryModalVM {
  const groupedItems = groupPredictionHistoryDisplayCandidates(
    command.source.versions.map((version) =>
      toDisplayCandidate({
        version,
        activityLabel: command.activityLabel,
        locale: command.locale,
        t: command.t,
        keys: command.keys,
      }),
    ),
  )

  const currentItem = findGroupedVersion(groupedItems, command.source.header.currentVersionId)
  if (currentItem === null) {
    throw new Error('Prediction history source requires a current version')
  }

  const previousItem = findGroupedVersion(groupedItems, command.source.header.previousVersionId)
  const originalItem = findGroupedVersion(groupedItems, command.source.header.originalVersionId)
  const reasonLabel = transitionLabel(command.source.header.reasonKind, command.t, command.keys)
  let comparisonLine: string | null = null

  if (previousItem !== null) {
    comparisonLine = command.t(
      command.keys.shipmentView.timeline.predictionHistory.header.beforeLine,
      {
        value: previousItem.primaryLabel,
      },
    )
  } else if (originalItem !== null) {
    comparisonLine = command.t(
      command.keys.shipmentView.timeline.predictionHistory.header.originalLine,
      {
        value: originalItem.primaryLabel,
      },
    )
  }

  return {
    header: {
      tone: resolveHeaderTone(command.source.header.tone),
      summaryLabel: headerSummaryLabel(command.source.header.summaryKind, command.t, command.keys),
      currentLine: command.t(
        command.keys.shipmentView.timeline.predictionHistory.header.currentLine,
        {
          value: currentItem.primaryLabel,
        },
      ),
      ...(comparisonLine === null ? {} : { comparisonLine }),
      ...(reasonLabel === null
        ? {}
        : {
            reasonLine: command.t(
              command.keys.shipmentView.timeline.predictionHistory.header.reasonLine,
              {
                value: reasonLabel,
              },
            ),
          }),
    },
    items: groupedItems.map((item) => ({
      id: item.id,
      isCurrent: item.isCurrent,
      ...(item.currentMarkerLabel === null ? {} : { currentMarkerLabel: item.currentMarkerLabel }),
      title: item.title,
      primaryLabel: item.primaryLabel,
      ...(item.secondaryLabel === null ? {} : { secondaryLabel: item.secondaryLabel }),
      ...(item.mainDateLabel === null ? {} : { mainDateLabel: item.mainDateLabel }),
      stateLabel: item.stateLabel,
      stateTone: item.stateTone,
      ...(item.explanatoryText === null ? {} : { explanatoryText: item.explanatoryText }),
      ...(item.transitionLabelFromPrevious === null
        ? {}
        : { transitionLabelFromPrevious: item.transitionLabelFromPrevious }),
      infoTooltipLines: buildTooltipLines({
        observedAtList: item.observedAtList,
        locale: command.locale,
        t: command.t,
        keys: command.keys,
      }),
    })),
  }
}
