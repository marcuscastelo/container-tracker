type TimelineLabelKeys = {
  readonly shipmentView: {
    readonly timeline: {
      readonly systemCreated: string
      readonly unknownEvent: string
      readonly nonMappedIndicator: string
    }
  }
  readonly tracking: {
    readonly observationType: {
      readonly GATE_IN: string
      readonly GATE_OUT: string
      readonly LOAD: string
      readonly DEPARTURE: string
      readonly ARRIVAL: string
      readonly DISCHARGE: string
      readonly DELIVERY: string
      readonly EMPTY_RETURN: string
      readonly TRANSSHIPMENT_INTENDED: string
      readonly TRANSSHIPMENT_POSITIONED_IN: string
      readonly TRANSSHIPMENT_POSITIONED_OUT: string
      readonly CUSTOMS_HOLD: string
      readonly CUSTOMS_RELEASE: string
    }
  }
}

type TimelineLabelEvent = {
  readonly type: string
  readonly carrierLabel?: string
}

type TranslateFn = (key: string) => string
export type NonMappedIndicatorVariant = 'badge' | 'suffix'
type TimelineEventLabelSource = 'canonical' | 'carrier' | 'unknown'
type TimelineEventLabelResolution = {
  readonly label: string
  readonly source: TimelineEventLabelSource
}
type TimelineEventLabelPresentation = {
  readonly label: string
  readonly showNonMappedIndicator: boolean
  readonly nonMappedIndicatorLabel: string
}

function toCanonicalLabelKey(keys: TimelineLabelKeys, eventType: string): string | undefined {
  switch (eventType) {
    case 'SYSTEM_CREATED':
      return keys.shipmentView.timeline.systemCreated
    case 'GATE_IN':
      return keys.tracking.observationType.GATE_IN
    case 'GATE_OUT':
      return keys.tracking.observationType.GATE_OUT
    case 'LOAD':
      return keys.tracking.observationType.LOAD
    case 'DEPARTURE':
      return keys.tracking.observationType.DEPARTURE
    case 'ARRIVAL':
      return keys.tracking.observationType.ARRIVAL
    case 'DISCHARGE':
      return keys.tracking.observationType.DISCHARGE
    case 'DELIVERY':
      return keys.tracking.observationType.DELIVERY
    case 'EMPTY_RETURN':
      return keys.tracking.observationType.EMPTY_RETURN
    case 'TRANSSHIPMENT_INTENDED':
      return keys.tracking.observationType.TRANSSHIPMENT_INTENDED
    case 'TRANSSHIPMENT_POSITIONED_IN':
      return keys.tracking.observationType.TRANSSHIPMENT_POSITIONED_IN
    case 'TRANSSHIPMENT_POSITIONED_OUT':
      return keys.tracking.observationType.TRANSSHIPMENT_POSITIONED_OUT
    case 'CUSTOMS_HOLD':
      return keys.tracking.observationType.CUSTOMS_HOLD
    case 'CUSTOMS_RELEASE':
      return keys.tracking.observationType.CUSTOMS_RELEASE
    default:
      return undefined
  }
}

function hasDisplayableCarrierLabel(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0)
}

export function resolveTimelineEventLabel(
  event: TimelineLabelEvent,
  t: TranslateFn,
  keys: TimelineLabelKeys,
): string {
  return resolveTimelineEventLabelResolution(event, t, keys).label
}

export function resolveTimelineEventLabelResolution(
  event: TimelineLabelEvent,
  t: TranslateFn,
  keys: TimelineLabelKeys,
): TimelineEventLabelResolution {
  const canonicalKey = toCanonicalLabelKey(keys, event.type)
  if (canonicalKey) {
    return {
      label: t(canonicalKey),
      source: 'canonical',
    }
  }

  if (hasDisplayableCarrierLabel(event.carrierLabel)) {
    return {
      label: event.carrierLabel,
      source: 'carrier',
    }
  }

  return {
    label: t(keys.shipmentView.timeline.unknownEvent),
    source: 'unknown',
  }
}

export function resolveTimelineEventLabelPresentation(
  event: TimelineLabelEvent,
  t: TranslateFn,
  keys: TimelineLabelKeys,
  nonMappedIndicatorVariant: NonMappedIndicatorVariant = 'badge',
): TimelineEventLabelPresentation {
  const resolution = resolveTimelineEventLabelResolution(event, t, keys)
  const nonMappedIndicatorLabel = t(keys.shipmentView.timeline.nonMappedIndicator)

  if (resolution.source !== 'carrier') {
    return {
      label: resolution.label,
      showNonMappedIndicator: false,
      nonMappedIndicatorLabel,
    }
  }

  if (nonMappedIndicatorVariant === 'suffix') {
    return {
      label: `${resolution.label} (${nonMappedIndicatorLabel})`,
      showNonMappedIndicator: false,
      nonMappedIndicatorLabel,
    }
  }

  return {
    label: resolution.label,
    showNonMappedIndicator: true,
    nonMappedIndicatorLabel,
  }
}
