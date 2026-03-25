import { createMemo, createSignal, type JSX, Show } from 'solid-js'
import { ObservationInspector } from '~/modules/process/ui/components/ObservationInspector'
import { PredictionHistoryModal } from '~/modules/process/ui/components/PredictionHistoryModal'
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
import { copyToClipboard } from '~/shared/utils/clipboard'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

type DateLabelProps = {
  readonly actualDateIso: TemporalValueDto | null
  readonly expectedDateIso: TemporalValueDto | null
  readonly locale: string
  readonly expectedLabel: string
  readonly actualLabel: string
  readonly toTooltip: (iso?: TemporalValueDto | null) => string | undefined
}

type CarrierLinkProps = {
  readonly href?: string
  readonly containerNumber?: string | null
  readonly label: string
}

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

async function copyAndOpenCarrierLink(
  href: string,
  containerNumber?: string | null,
): Promise<void> {
  try {
    if (containerNumber) {
      await copyToClipboard(containerNumber)
    }
  } catch {
    /* ignore copy failures */
  }

  try {
    window.open(href, '_blank')
  } catch {
    /* ignore window open failures */
  }
}

function CarrierLinkButton(props: CarrierLinkProps): JSX.Element | null {
  return (
    <Show when={props.href}>
      {(href) => (
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          title={props.label}
          class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded text-text-muted hover:text-foreground"
          onClick={(event) => {
            event.preventDefault()
            void copyAndOpenCarrierLink(href(), props.containerNumber)
          }}
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <title>{props.label}</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
            />
          </svg>
        </a>
      )}
    </Show>
  )
}

export function TimelineNode(props: {
  readonly event: TrackingTimelineItem
  readonly isLast: boolean
  readonly carrier?: string | null
  readonly containerNumber?: string | null
  readonly observation?: ContainerObservationVM
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly highlighted?: boolean
}): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const [showPredictionHistory, setShowPredictionHistory] = createSignal(false)
  const [showObservationInspector, setShowObservationInspector] = createSignal(false)

  const isExpected = () => props.event.eventTimeType === 'EXPECTED'
  const isExpiredExpected = () => props.event.derivedState === 'EXPIRED_EXPECTED'
  const hasPredictionHistory = () =>
    Boolean(props.event.seriesHistory && props.event.seriesHistory.classified.length > 1)
  const hasObservation = () => Boolean(props.observation)

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
  const nonMappedBadgeLabel = createMemo(() =>
    labelPresentation().showNonMappedIndicator
      ? labelPresentation().nonMappedIndicatorLabel
      : undefined,
  )
  const emptyContainerBadgeLabel = createMemo(() =>
    props.observation?.isEmpty === true
      ? t(keys.shipmentView.timeline.emptyContainerBadge)
      : undefined,
  )

  const labelPresentation = createMemo(() => {
    const indicatorVariant = props.nonMappedIndicatorVariant ?? 'badge'
    const presentation = resolveTimelineEventLabelPresentation(
      props.event,
      t,
      keys,
      indicatorVariant,
    )
    let currentLabel = presentation.label
    if (props.event.vesselName) {
      currentLabel += ` — ${props.event.vesselName}`
      if (props.event.voyage) currentLabel += ` (${props.event.voyage})`
    }
    return {
      ...presentation,
      label: currentLabel,
    }
  })

  const etaChipLabel = createMemo(() => {
    // ETA chip removed: render expected date on the right instead.
    return null
  })

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

  return (
    <>
      <TimelineNodeLayout
        isLast={props.isLast}
        isExpected={isExpected()}
        isExpiredExpected={isExpiredExpected()}
        highlighted={props.highlighted ?? false}
        dotClass={styles().dot}
        lineClass={styles().line}
        textClass={styles().text}
        label={labelPresentation().label}
        eventIcon={eventIcon()}
        etaChipLabel={etaChipLabel()}
        showPredictionHistoryButton={hasPredictionHistory()}
        onOpenPredictionHistory={() => setShowPredictionHistory(true)}
        predictionHistoryLabel={t(keys.shipmentView.timeline.viewPredictionHistory)}
        showObservationButton={hasObservation()}
        onOpenObservation={() => setShowObservationInspector(true)}
        observationLabel={t(keys.shipmentView.timeline.viewObservation)}
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

      <Show when={props.event.seriesHistory}>
        {(seriesHistory) => (
          <PredictionHistoryModal
            seriesHistory={seriesHistory()}
            activityLabel={labelPresentation().label}
            isOpen={showPredictionHistory()}
            onClose={() => setShowPredictionHistory(false)}
          />
        )}
      </Show>

      <Show when={props.observation}>
        {(observation) => (
          <ObservationInspector
            observation={observation()}
            isOpen={showObservationInspector()}
            onClose={() => setShowObservationInspector(false)}
          />
        )}
      </Show>
    </>
  )
}
