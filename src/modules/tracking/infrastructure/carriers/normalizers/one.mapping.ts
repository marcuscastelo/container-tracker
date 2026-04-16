import type {
  EventTimeType,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'

type OneMatrixRegistryEntry = {
  readonly type: ObservationType
  readonly isEmpty: ObservationDraft['is_empty']
  readonly expectedEventNames: readonly string[]
}

export type OneResolvedSemanticEvent = {
  readonly type: ObservationType
  readonly isEmpty: ObservationDraft['is_empty']
  readonly known: boolean
}

const ONE_MATRIX_REGISTRY: Readonly<Record<string, OneMatrixRegistryEntry>> = {
  E012: {
    type: 'GATE_OUT',
    isEmpty: true,
    expectedEventNames: ['Empty Container Release to Shipper'],
  },
  E040: {
    type: 'GATE_IN',
    isEmpty: null,
    expectedEventNames: ['Gate In to Outbound Terminal'],
  },
  E058: {
    type: 'LOAD',
    isEmpty: null,
    expectedEventNames: ['Loaded on Vessel at Port of Loading'],
  },
  E061: {
    type: 'DEPARTURE',
    isEmpty: null,
    expectedEventNames: ['Vessel Departure from Port of Loading'],
  },
  E066: {
    type: 'ARRIVAL',
    isEmpty: null,
    expectedEventNames: ['Vessel Arrival at T/S Port'],
  },
  'E067-01': {
    type: 'DISCHARGE',
    isEmpty: null,
    expectedEventNames: ['Unloaded from Vessel at Transshipment Port'],
  },
  'E070-01': {
    type: 'LOAD',
    isEmpty: null,
    expectedEventNames: ['Loaded on Vessel at Transshipment Port'],
  },
  'E073-01': {
    type: 'DEPARTURE',
    isEmpty: null,
    expectedEventNames: ['Departure from Transshipment Port'],
  },
  E089: {
    type: 'ARRIVAL',
    isEmpty: null,
    expectedEventNames: ['Vessel Arrival at Port of Discharge'],
  },
  E090: {
    type: 'DISCHARGE',
    isEmpty: null,
    expectedEventNames: ['Unloaded from Vessel at Port of Discharging'],
  },
  E106: {
    type: 'GATE_OUT',
    isEmpty: null,
    expectedEventNames: [
      'Gate Out from Inbound Terminal for Delivery to Consignee (or Port Shuttle)',
    ],
  },
  E138: {
    type: 'EMPTY_RETURN',
    isEmpty: true,
    expectedEventNames: ['Empty Container Returned from Customer'],
  },
}

function normalizeOneMatrixId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

function doesEventNameMatchEntry(
  eventName: string,
  expectedEventNames: readonly string[],
): boolean {
  const normalizedEventName = toLookupMapKey(eventName)
  return expectedEventNames.some((expectedEventName) => {
    const normalizedExpected = toLookupMapKey(expectedEventName)
    return (
      normalizedEventName === normalizedExpected ||
      normalizedEventName.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedEventName)
    )
  })
}

export function mapOneTriggerType(triggerType: string | null | undefined): EventTimeType {
  if (typeof triggerType !== 'string') return 'EXPECTED'
  return triggerType.trim().toUpperCase() === 'ACTUAL' ? 'ACTUAL' : 'EXPECTED'
}

export function resolveOneSemanticEvent(command: {
  readonly matrixId: string | null | undefined
  readonly eventName?: string | null | undefined
  readonly source: 'cop' | 'search-cargo'
}): OneResolvedSemanticEvent {
  const normalizedMatrixId = normalizeOneMatrixId(command.matrixId)
  if (normalizedMatrixId === null) {
    return {
      type: 'OTHER',
      isEmpty: null,
      known: false,
    }
  }

  const entry = ONE_MATRIX_REGISTRY[normalizedMatrixId]
  if (entry === undefined) {
    console.warn('[tracking:one] unknown matrixId', {
      source: command.source,
      matrixId: normalizedMatrixId,
      eventName: command.eventName ?? null,
    })
    return {
      type: 'OTHER',
      isEmpty: null,
      known: false,
    }
  }

  const eventName = typeof command.eventName === 'string' ? command.eventName.trim() : ''
  if (eventName.length > 0 && !doesEventNameMatchEntry(eventName, entry.expectedEventNames)) {
    console.warn('[tracking:one] matrixId/eventName mismatch', {
      source: command.source,
      matrixId: normalizedMatrixId,
      eventName,
      expectedEventNames: [...entry.expectedEventNames],
    })
  }

  return {
    type: entry.type,
    isEmpty: entry.isEmpty,
    known: true,
  }
}
