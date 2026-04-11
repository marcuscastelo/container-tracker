import { createEffect, createMemo, createSignal, type JSX, Show } from 'solid-js'
import { CarrierLinkButton } from '~/modules/process/ui/components/CarrierLinkButton'
import { ObservationInspector } from '~/modules/process/ui/components/ObservationInspector'
import { PredictionHistoryModal } from '~/modules/process/ui/components/PredictionHistoryModal'
import {
  fetchObservationInspector,
  fetchTimelinePredictionHistory,
} from '~/modules/process/ui/fetchProcessTrackingDetails'
import { toPredictionHistoryModalVM } from '~/modules/process/ui/mappers/predictionHistory.ui-mapper'
import {
  type NonMappedIndicatorVariant,
  resolveTimelineEventLabelPresentation,
} from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'
import { TimelineNodeLayout } from '~/modules/process/ui/TimelineNode.layout'
import { timelineEventIcon } from '~/modules/process/ui/timeline/timelineEventIcon'
import type { ContainerObservationVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingTimelineItem } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import type { TemporalValueDto } from '~/shared/time/dto'
import { carrierTrackUrl } from '~/shared/utils/carrier'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'
type TimelineNodeProps = {
  readonly containerId: string
  readonly event: TrackingTimelineItem
  readonly isLast: boolean
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly observation?: ContainerObservationVM
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
}

type DateLabelProps = {
  readonly actualDateIso: TemporalValueDto | null
  readonly expectedDateIso: TemporalValueDto | null
  readonly locale: string
  readonly expectedLabel: string
  readonly actualLabel: string
  readonly toTooltip: (iso?: TemporalValueDto | null) => string | undefined
}

type PredictionHistorySourceState = Awaited<
  ReturnType<typeof fetchTimelinePredictionHistory>
> | null

function toOptionalTimelineNodeLayoutProps(params: {
  readonly nonMappedBadgeLabel: string | undefined
  readonly emptyContainerBadgeLabel: string | undefined
  readonly location: string | null | undefined
}): {
  readonly nonMappedBadgeLabel?: string
  readonly emptyContainerBadgeLabel?: string
  readonly location?: string | null
} {
  return {
    ...(params.nonMappedBadgeLabel === undefined
      ? {}
      : { nonMappedBadgeLabel: params.nonMappedBadgeLabel }),
    ...(params.emptyContainerBadgeLabel === undefined
      ? {}
      : { emptyContainerBadgeLabel: params.emptyContainerBadgeLabel }),
    ...(params.location === undefined ? {} : { location: params.location }),
  }
}

function toOptionalCarrierLinkProps(params: {
  readonly href: string | undefined
  readonly containerNumber: string | null | undefined
}): {
  readonly href?: string
  readonly containerNumber?: string | null
} {
  return {
    ...(params.href === undefined ? {} : { href: params.href }),
    ...(params.containerNumber === undefined ? {} : { containerNumber: params.containerNumber }),
  }
}

function toIsoTooltip(iso?: TemporalValueDto | null): string | undefined {
  if (!iso) return undefined
  return iso.value
}

function DateLabel(props: DateLabelProps): JSX.Element | null {
  return (
    <Show
      when={props.actualDateIso}
      fallback={
        <Show when={props.expectedDateIso}>
          {(expectedDateIso) => (
            <div class="flex flex-col items-end" title={props.toTooltip(expectedDateIso())}>
              <span class="tabular-nums text-sm-ui font-medium text-foreground">
                {formatDateForLocale(expectedDateIso(), props.locale)}
              </span>
              <span class="mt-0.5 text-micro leading-tight text-text-muted">
                {props.expectedLabel}
              </span>
            </div>
          )}
        </Show>
      }
    >
      {(actualDateIso) => (
        <p
          class="text-micro tabular-nums text-text-muted"
          title={props.toTooltip(actualDateIso() ?? undefined)}
        >
          <span class="sr-only">{props.actualLabel}</span>
          {formatDateForLocale(actualDateIso(), props.locale)}
        </p>
      )}
    </Show>
  )
}

function usePredictionHistoryController(command: {
  readonly containerId: () => string
  readonly event: () => TrackingTimelineItem
  readonly loadErrorMessage: () => string
}) {
  const [showPredictionHistory, setShowPredictionHistory] = createSignal(false)
  const [predictionHistorySource, setPredictionHistorySource] =
    createSignal<PredictionHistorySourceState>(null)
  const [seriesHistoryLoading, setSeriesHistoryLoading] = createSignal(false)
  const [seriesHistoryErrorMessage, setSeriesHistoryErrorMessage] = createSignal<string | null>(
    null,
  )

  createEffect(() => {
    void command.event().id
    setShowPredictionHistory(false)
    setPredictionHistorySource(null)
    setSeriesHistoryLoading(false)
    setSeriesHistoryErrorMessage(null)
  })

  const hasPredictionHistory = createMemo(() => {
    const event = command.event()
    return event.hasSeriesHistory === true
  })

  const openPredictionHistory = async (): Promise<void> => {
    setShowPredictionHistory(true)
    setSeriesHistoryErrorMessage(null)

    const event = command.event()
    if (predictionHistorySource() !== null || event.hasSeriesHistory !== true) return

    setSeriesHistoryLoading(true)
    try {
      const loadedPredictionHistory = await fetchTimelinePredictionHistory(
        command.containerId(),
        event.id,
      )
      setPredictionHistorySource(loadedPredictionHistory)
    } catch (error) {
      console.error(`Failed to load series history for timeline item ${event.id}:`, error)
      setSeriesHistoryErrorMessage(command.loadErrorMessage())
    } finally {
      setSeriesHistoryLoading(false)
    }
  }

  return {
    hasPredictionHistory,
    openPredictionHistory,
    closePredictionHistory: () => setShowPredictionHistory(false),
    showPredictionHistory,
    predictionHistorySource,
    seriesHistoryLoading,
    seriesHistoryErrorMessage,
  }
}

function useObservationInspectorController(command: {
  readonly containerId: () => string
  readonly event: () => TrackingTimelineItem
  readonly initialObservation: () => ContainerObservationVM | null
  readonly loadErrorMessage: () => string
}) {
  const [showObservationInspector, setShowObservationInspector] = createSignal(false)
  const [observation, setObservation] = createSignal<ContainerObservationVM | null>(null)
  const [observationLoading, setObservationLoading] = createSignal(false)
  const [observationErrorMessage, setObservationErrorMessage] = createSignal<string | null>(null)

  createEffect(() => {
    void command.event().id
    setShowObservationInspector(false)
    setObservation(command.initialObservation())
    setObservationLoading(false)
    setObservationErrorMessage(null)
  })

  const hasObservation = createMemo(() => {
    const event = command.event()
    return typeof event.observationId === 'string' || observation() !== null
  })

  const openObservationInspector = async (): Promise<void> => {
    setShowObservationInspector(true)
    setObservationErrorMessage(null)

    const event = command.event()
    if (observation() !== null || typeof event.observationId !== 'string') return

    setObservationLoading(true)
    try {
      const loadedObservation = await fetchObservationInspector(
        command.containerId(),
        event.observationId,
      )
      setObservation(loadedObservation)
    } catch (error) {
      console.error(`Failed to load observation ${event.observationId}:`, error)
      setObservationErrorMessage(command.loadErrorMessage())
    } finally {
      setObservationLoading(false)
    }
  }

  return {
    hasObservation,
    openObservationInspector,
    closeObservationInspector: () => setShowObservationInspector(false),
    showObservationInspector,
    observation,
    observationLoading,
    observationErrorMessage,
  }
}

export function TimelineNode(props: TimelineNodeProps): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const loadErrorMessage = () => t(keys.shipmentView.loadError)
  const predictionHistory = usePredictionHistoryController({
    containerId: () => props.containerId,
    event: () => props.event,
    loadErrorMessage,
  })
  const observationInspector = useObservationInspectorController({
    containerId: () => props.containerId,
    event: () => props.event,
    initialObservation: () => props.observation ?? null,
    loadErrorMessage,
  })

  const isExpected = () => props.event.eventTimeType === 'EXPECTED'
  const isExpiredExpected = () => props.event.derivedState === 'EXPIRED_EXPECTED'
  const hasSeriesConflict = createMemo(() => props.event.seriesConflict != null)

  const status = createMemo<EventStatus>(() => {
    if (!isExpected()) return 'completed'
    return isExpiredExpected() ? 'delayed' : 'expected'
  })

  const styles = createMemo((): { dot: string; line: string; text: string } => {
    switch (status()) {
      case 'completed':
        return {
          dot: 'border-tone-success-border bg-tone-success-bg text-tone-success-fg',
          line: 'bg-tone-success-border',
          text: 'font-semibold text-foreground',
        }
      case 'current':
        return {
          dot: 'border-tone-info-border bg-tone-info-bg text-tone-info-fg',
          line: 'bg-tone-info-border',
          text: 'font-semibold text-foreground',
        }
      case 'delayed':
        return {
          dot: 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg',
          line: 'bg-border',
          text: 'font-semibold text-tone-danger-fg',
        }
      default:
        return {
          dot: 'border-border bg-surface text-text-muted',
          line: 'bg-border',
          text: 'font-medium text-foreground',
        }
    }
  })

  const href = createMemo(() => {
    const trackUrl = carrierTrackUrl(props.carrier ?? null, props.containerNumber ?? '')
    return typeof trackUrl === 'string' ? trackUrl : undefined
  })

  const labelPresentation = createMemo(() => {
    const indicatorVariant = props.nonMappedIndicatorVariant ?? 'badge'
    return resolveTimelineEventLabelPresentation(props.event, t, keys, indicatorVariant)
  })
  const timelineLabel = createMemo(() => {
    let currentLabel = labelPresentation().label
    if (props.event.vesselName) {
      currentLabel += ` — ${props.event.vesselName}`
      if (props.event.voyage) currentLabel += ` (${props.event.voyage})`
    }
    return currentLabel
  })
  const nonMappedBadgeLabel = createMemo(() =>
    labelPresentation().showNonMappedIndicator
      ? labelPresentation().nonMappedIndicatorLabel
      : undefined,
  )
  const emptyContainerBadgeLabel = createMemo(() =>
    observationInspector.observation()?.isEmpty === true
      ? t(keys.shipmentView.timeline.emptyContainerBadge)
      : undefined,
  )

  const actualDateIso = createMemo(() =>
    props.event.eventTimeType === 'ACTUAL' ? props.event.eventTime : null,
  )
  const expectedDateIso = createMemo(() =>
    props.event.eventTimeType === 'EXPECTED' ? props.event.eventTime : null,
  )
  const eventIcon = createMemo<JSX.Element | null>(() => {
    const Icon = timelineEventIcon(props.event.type)
    if (!Icon) return null
    return <Icon class="h-4 w-4 shrink-0" aria-hidden="true" />
  })
  const predictionHistoryModalVm = createMemo(() => {
    const source = predictionHistory.predictionHistorySource()
    if (source === null) return null

    return toPredictionHistoryModalVM({
      source,
      activityLabel: labelPresentation().label,
      locale: locale(),
      t,
      keys,
    })
  })

  return (
    <>
      <TimelineNodeLayout
        isLast={props.isLast}
        isExpected={isExpected()}
        isExpiredExpected={isExpiredExpected()}
        hasSeriesConflict={hasSeriesConflict()}
        dotClass={styles().dot}
        lineClass={styles().line}
        textClass={styles().text}
        label={timelineLabel()}
        eventIcon={eventIcon()}
        etaChipLabel={null}
        showPredictionHistoryButton={predictionHistory.hasPredictionHistory()}
        onOpenPredictionHistory={() => {
          void predictionHistory.openPredictionHistory()
        }}
        predictionHistoryLabel={t(keys.shipmentView.timeline.viewPredictionHistory)}
        showObservationButton={observationInspector.hasObservation()}
        onOpenObservation={() => {
          void observationInspector.openObservationInspector()
        }}
        observationLabel={t(keys.shipmentView.timeline.viewObservation)}
        conflictBadgeLabel={t(keys.shipmentView.timeline.conflictBadge)}
        conflictTooltip={t(keys.shipmentView.timeline.conflictTooltip)}
        expiredExpectedLabel={t(keys.shipmentView.timeline.expiredExpected)}
        expiredExpectedTooltip={t(keys.shipmentView.timeline.expiredExpectedTooltip)}
        expectedLabel={t(keys.shipmentView.timeline.expected)}
        predictedTooltip={t(keys.shipmentView.timeline.predictedTooltip)}
        dateLabel={
          <DateLabel
            actualDateIso={actualDateIso()}
            expectedDateIso={expectedDateIso()}
            locale={locale()}
            expectedLabel={t(keys.shipmentView.timeline.expected).toLowerCase()}
            actualLabel={t(keys.shipmentView.timeline.actual)}
            toTooltip={toIsoTooltip}
          />
        }
        carrierLink={
          <CarrierLinkButton
            label={t(keys.shipmentView.timeline.viewOnCarrierSite)}
            class="ml-1"
            {...toOptionalCarrierLinkProps({
              href: href(),
              containerNumber: props.containerNumber,
            })}
          />
        }
        {...toOptionalTimelineNodeLayoutProps({
          nonMappedBadgeLabel: nonMappedBadgeLabel(),
          emptyContainerBadgeLabel: emptyContainerBadgeLabel(),
          location: props.event.location,
        })}
      />

      <PredictionHistoryModal
        predictionHistory={predictionHistoryModalVm()}
        activityLabel={labelPresentation().label}
        isOpen={predictionHistory.showPredictionHistory()}
        loading={predictionHistory.seriesHistoryLoading()}
        errorMessage={predictionHistory.seriesHistoryErrorMessage()}
        onClose={predictionHistory.closePredictionHistory}
      />

      <ObservationInspector
        observation={observationInspector.observation()}
        isOpen={observationInspector.showObservationInspector()}
        loading={observationInspector.observationLoading()}
        errorMessage={observationInspector.observationErrorMessage()}
        onClose={observationInspector.closeObservationInspector}
      />
    </>
  )
}
