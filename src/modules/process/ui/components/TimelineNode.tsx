import type { JSX } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { PredictionHistoryModal } from '~/modules/process/ui/components/PredictionHistoryModal'
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
          <p
            class="text-[10px] tabular-nums text-slate-300"
            title={props.toTooltip(props.expectedDateIso)}
          >
            {props.expectedLabel} {formatDateForLocale(props.expectedDateIso, props.locale)}
          </p>
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

function typeToLabel(
  eventType: TrackingTimelineItem['type'],
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  switch (eventType) {
    case 'SYSTEM_CREATED':
      return t(keys.shipmentView.timeline.systemCreated)
    case 'GATE_IN':
      return t(keys.tracking.observationType.GATE_IN)
    case 'GATE_OUT':
      return t(keys.tracking.observationType.GATE_OUT)
    case 'LOAD':
      return t(keys.tracking.observationType.LOAD)
    case 'DEPARTURE':
      return t(keys.tracking.observationType.DEPARTURE)
    case 'ARRIVAL':
      return t(keys.tracking.observationType.ARRIVAL)
    case 'DISCHARGE':
      return t(keys.tracking.observationType.DISCHARGE)
    case 'DELIVERY':
      return t(keys.tracking.observationType.DELIVERY)
    case 'EMPTY_RETURN':
      return t(keys.tracking.observationType.EMPTY_RETURN)
    case 'CUSTOMS_HOLD':
      return t(keys.tracking.observationType.CUSTOMS_HOLD)
    case 'CUSTOMS_RELEASE':
      return t(keys.tracking.observationType.CUSTOMS_RELEASE)
    default:
      return t(keys.tracking.observationType.OTHER)
  }
}

export function TimelineNode(props: {
  readonly event: TrackingTimelineItem
  readonly isLast: boolean
  readonly carrier?: string | null
  readonly containerNumber?: string | null
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

  const label = createMemo(() => {
    let currentLabel = typeToLabel(props.event.type, t, keys)
    if (props.event.vesselName) {
      currentLabel += ` — ${props.event.vesselName}`
      if (props.event.voyage) currentLabel += ` (${props.event.voyage})`
    }
    return currentLabel
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
        dotClass={styles().dot}
        lineClass={styles().line}
        textClass={styles().text}
        label={label()}
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
            expectedLabel={t(keys.shipmentView.timeline.expected)}
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
          activityLabel={label()}
          isOpen={showPredictionHistory()}
          onClose={() => setShowPredictionHistory(false)}
        />
      ) : null}
    </>
  )
}
