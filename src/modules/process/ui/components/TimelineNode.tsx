import type { JSX } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { timelineEventIconPath } from '~/modules/process/ui/components/Icons'
import { PredictionHistoryModal } from '~/modules/process/ui/components/PredictionHistoryModal'
import {
  type NonMappedIndicatorVariant,
  resolveTimelineEventLabelPresentation,
} from '~/modules/process/ui/mappers/trackingEventLabel.ui-mapper'
import { TimelineNodeLayout } from '~/modules/process/ui/TimelineNode.layout'
import type { TrackingTimelineItem } from '~/modules/tracking/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import { carrierTrackUrl } from '~/shared/utils/carrier'
import { copyToClipboard } from '~/shared/utils/clipboard'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type EventStatus = 'completed' | 'current' | 'expected' | 'delayed'

type DateLabelProps = {
  readonly actualDateIso: string | null
  readonly expectedDateIso: string | null
  readonly locale: string
  readonly expectedLabel: string
  readonly actualLabel: string
  readonly toTooltip: (iso?: string | null) => string | undefined
}

type CarrierLinkProps = {
  readonly href: string | undefined
  readonly containerNumber?: string | null
  readonly label: string
}

function toIsoTooltip(iso?: string | null): string | undefined {
  if (!iso) return undefined
  const matched = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/)
  if (matched) return matched[1]
  return iso.replace(/\.\d+Z?$/, '').replace(/Z$/, '')
}

function DateLabel(props: DateLabelProps): JSX.Element | null {
  return (
    <Show
      when={props.actualDateIso}
      fallback={
        props.expectedDateIso ? (
          <div class="flex flex-col items-end" title={props.toTooltip(props.expectedDateIso)}>
            <span class="tabular-nums text-sm font-medium text-slate-700">
              {formatDateForLocale(props.expectedDateIso, props.locale)}
            </span>
            <span class="text-[10px] text-slate-500 leading-tight mt-0.5">
              {props.expectedLabel}
            </span>
          </div>
        ) : null
      }
    >
      {(actualDateIso) => (
        <p
          class="text-[10px] tabular-nums text-slate-500"
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
          class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded text-slate-300 hover:text-slate-500"
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
  readonly nonMappedIndicatorVariant?: NonMappedIndicatorVariant
  readonly highlighted?: boolean
}): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const [showPredictionHistory, setShowPredictionHistory] = createSignal(false)

  const isExpected = () => props.event.eventTimeType === 'EXPECTED'
  const isExpiredExpected = () => props.event.derivedState === 'EXPIRED_EXPECTED'
  const hasPredictionHistory = () => Boolean(props.event.series && props.event.series.length > 1)

  const status = createMemo<EventStatus>(() => {
    if (!isExpected()) return 'completed'
    return isExpiredExpected() ? 'delayed' : 'expected'
  })

  const styles = createMemo((): { dot: string; line: string; text: string } => {
    switch (status()) {
      case 'completed':
        return {
          dot: 'bg-emerald-500',
          line: 'bg-emerald-300',
          text: 'text-slate-700',
        }
      case 'current':
        return {
          dot: 'bg-blue-500 ring-2 ring-blue-100',
          line: 'bg-slate-200',
          text: 'font-medium text-slate-800',
        }
      case 'delayed':
        return {
          dot: 'bg-red-400 ring-2 ring-red-50',
          line: 'bg-slate-200',
          text: 'font-medium text-red-600',
        }
      default:
        return {
          dot: 'border border-slate-300 bg-white',
          line: 'bg-slate-200',
          text: 'text-slate-400',
        }
    }
  })

  const href = createMemo(() => {
    const trackUrl = carrierTrackUrl(props.carrier ?? null, props.containerNumber ?? '')
    return typeof trackUrl === 'string' ? trackUrl : undefined
  })

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

  const ARRIVAL_EVENT_TYPES: ReadonlySet<string> = new Set(['ARRIVAL', 'DISCHARGE'])

  const etaChipLabel = createMemo(() => {
    // ETA chip removed: render expected date on the right instead.
    return null
  })

  const actualDateIso = createMemo(() =>
    props.event.eventTimeType === 'ACTUAL' ? props.event.eventTimeIso : null,
  )
  const expectedDateIso = createMemo(() =>
    props.event.eventTimeType === 'EXPECTED' ? props.event.eventTimeIso : null,
  )

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
        eventIconPath={timelineEventIconPath(props.event.type)}
        etaChipLabel={etaChipLabel()}
        nonMappedBadgeLabel={
          labelPresentation().showNonMappedIndicator
            ? labelPresentation().nonMappedIndicatorLabel
            : undefined
        }
        showPredictionHistoryButton={hasPredictionHistory()}
        onOpenPredictionHistory={() => setShowPredictionHistory(true)}
        predictionHistoryLabel={t(keys.shipmentView.timeline.viewPredictionHistory)}
        expiredExpectedLabel={t(keys.shipmentView.timeline.expiredExpected)}
        expiredExpectedTooltip={t(keys.shipmentView.timeline.expiredExpectedTooltip)}
        expectedLabel={t(keys.shipmentView.timeline.expected)}
        predictedTooltip={t(keys.shipmentView.timeline.predictedTooltip)}
        location={props.event.location}
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
            href={href()}
            containerNumber={props.containerNumber}
            label={t(keys.shipmentView.timeline.viewOnCarrierSite)}
          />
        }
      />

      {props.event.series ? (
        <PredictionHistoryModal
          series={props.event.series}
          activityLabel={labelPresentation().label}
          isOpen={showPredictionHistory()}
          onClose={() => setShowPredictionHistory(false)}
        />
      ) : null}
    </>
  )
}
