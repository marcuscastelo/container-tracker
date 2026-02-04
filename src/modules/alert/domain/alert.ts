import { z } from 'zod'

/**
 * Alert Domain Model
 *
 * Alerts are interpretations of events or absences of events.
 * They are always derivable from the timeline and should never be the source of truth.
 *
 * Key decisions (from brainstorm):
 * - Alerts are NOT events
 * - Every alert must point to related events (or explain missing events)
 * - Alerts can be acknowledged, resolved, but never deleted during active tracking
 * - TTL applies after resolution
 */

// Alert categories - higher level grouping
export const AlertCategory = z.enum(['eta', 'movement', 'customs', 'data', 'status'])
export type AlertCategory = z.infer<typeof AlertCategory>

// Alert severity levels
export const AlertSeverity = z.enum(['info', 'success', 'warning', 'danger'])
export type AlertSeverity = z.infer<typeof AlertSeverity>

// Alert state lifecycle
export const AlertState = z.enum(['active', 'acknowledged', 'resolved'])
export type AlertState = z.infer<typeof AlertState>

// Alert codes - specific alert types for deterministic rules
export const AlertCode = z.enum([
  // ETA category
  'ETA_MISSING',
  'ETA_PASSED',
  'ETA_CHANGED',
  // Movement category
  'NO_MOVEMENT_7D',
  'UNEXPECTED_MOVEMENT',
  'VESSEL_DEPARTURE',
  'VESSEL_ARRIVAL',
  'DISCHARGED',
  'DELIVERED',
  // Customs category
  'CUSTOMS_HOLD',
  'CUSTOMS_RELEASED',
  // Data category
  'CARRIER_SILENT',
  'DATA_INCONSISTENT',
  'EVENTS_OUT_OF_ORDER',
  // Status category
  'STATUS_CHANGED',
  'PROCESS_CREATED',
])
export type AlertCode = z.infer<typeof AlertCode>

/**
 * Alert Schema - the main entity
 */
export const AlertSchema = z.object({
  id: z.string().uuid(),
  // References (at least one should be set)
  process_id: z.string().uuid().nullable().optional(),
  container_id: z.string().uuid().nullable().optional(),
  // Alert classification
  category: AlertCategory,
  code: AlertCode,
  severity: AlertSeverity,
  // Human-readable content
  title: z.string(),
  description: z.string().nullable().optional(),
  // Link to timeline events
  related_event_ids: z.array(z.string()).nullable().optional(),
  // Lifecycle
  state: AlertState.default('active'),
  created_at: z.date(),
  updated_at: z.date(),
  acknowledged_at: z.date().nullable().optional(),
  resolved_at: z.date().nullable().optional(),
  expires_at: z.date().nullable().optional(),
})
export type Alert = z.infer<typeof AlertSchema>

/**
 * Alert metadata - configuration for each alert code
 */
export const ALERT_METADATA: Record<
  AlertCode,
  {
    category: AlertCategory
    defaultSeverity: AlertSeverity
    titleKey: string
    descriptionKey?: string
    ttlDaysAfterResolution: number
  }
> = {
  // ETA
  ETA_MISSING: {
    category: 'eta',
    defaultSeverity: 'warning',
    titleKey: 'alerts.eta.missing.title',
    descriptionKey: 'alerts.eta.missing.description',
    ttlDaysAfterResolution: 30,
  },
  ETA_PASSED: {
    category: 'eta',
    defaultSeverity: 'danger',
    titleKey: 'alerts.eta.passed.title',
    descriptionKey: 'alerts.eta.passed.description',
    ttlDaysAfterResolution: 30,
  },
  ETA_CHANGED: {
    category: 'eta',
    defaultSeverity: 'info',
    titleKey: 'alerts.eta.changed.title',
    descriptionKey: 'alerts.eta.changed.description',
    ttlDaysAfterResolution: 7,
  },
  // Movement
  NO_MOVEMENT_7D: {
    category: 'movement',
    defaultSeverity: 'warning',
    titleKey: 'alerts.movement.noMovement.title',
    descriptionKey: 'alerts.movement.noMovement.description',
    ttlDaysAfterResolution: 30,
  },
  UNEXPECTED_MOVEMENT: {
    category: 'movement',
    defaultSeverity: 'warning',
    titleKey: 'alerts.movement.unexpected.title',
    descriptionKey: 'alerts.movement.unexpected.description',
    ttlDaysAfterResolution: 30,
  },
  VESSEL_DEPARTURE: {
    category: 'movement',
    defaultSeverity: 'info',
    titleKey: 'alerts.movement.vesselDeparture.title',
    ttlDaysAfterResolution: 7,
  },
  VESSEL_ARRIVAL: {
    category: 'movement',
    defaultSeverity: 'info',
    titleKey: 'alerts.movement.vesselArrival.title',
    ttlDaysAfterResolution: 7,
  },
  DISCHARGED: {
    category: 'movement',
    defaultSeverity: 'success',
    titleKey: 'alerts.movement.discharged.title',
    ttlDaysAfterResolution: 7,
  },
  DELIVERED: {
    category: 'movement',
    defaultSeverity: 'success',
    titleKey: 'alerts.movement.delivered.title',
    ttlDaysAfterResolution: 90,
  },
  // Customs
  CUSTOMS_HOLD: {
    category: 'customs',
    defaultSeverity: 'danger',
    titleKey: 'alerts.customs.hold.title',
    descriptionKey: 'alerts.customs.hold.description',
    ttlDaysAfterResolution: 90,
  },
  CUSTOMS_RELEASED: {
    category: 'customs',
    defaultSeverity: 'success',
    titleKey: 'alerts.customs.released.title',
    ttlDaysAfterResolution: 30,
  },
  // Data
  CARRIER_SILENT: {
    category: 'data',
    defaultSeverity: 'info',
    titleKey: 'alerts.data.carrierSilent.title',
    descriptionKey: 'alerts.data.carrierSilent.description',
    ttlDaysAfterResolution: 14,
  },
  DATA_INCONSISTENT: {
    category: 'data',
    defaultSeverity: 'warning',
    titleKey: 'alerts.data.inconsistent.title',
    descriptionKey: 'alerts.data.inconsistent.description',
    ttlDaysAfterResolution: 14,
  },
  EVENTS_OUT_OF_ORDER: {
    category: 'data',
    defaultSeverity: 'warning',
    titleKey: 'alerts.data.outOfOrder.title',
    descriptionKey: 'alerts.data.outOfOrder.description',
    ttlDaysAfterResolution: 14,
  },
  // Status
  STATUS_CHANGED: {
    category: 'status',
    defaultSeverity: 'info',
    titleKey: 'alerts.status.changed.title',
    ttlDaysAfterResolution: 7,
  },
  PROCESS_CREATED: {
    category: 'status',
    defaultSeverity: 'info',
    titleKey: 'alerts.status.processCreated.title',
    ttlDaysAfterResolution: 7,
  },
}

/**
 * Create a new alert (factory function)
 */
export function createAlert(params: {
  process_id?: string | null
  container_id?: string | null
  code: AlertCode
  title: string
  description?: string | null
  related_event_ids?: readonly string[] | null
  severity?: AlertSeverity
}): Omit<Alert, 'id' | 'created_at' | 'updated_at'> {
  const metadata = ALERT_METADATA[params.code]

  return {
    process_id: params.process_id ?? null,
    container_id: params.container_id ?? null,
    category: metadata.category,
    code: params.code,
    severity: params.severity ?? metadata.defaultSeverity,
    title: params.title,
    description: params.description ?? null,
    related_event_ids: params.related_event_ids ? [...params.related_event_ids] : null,
    state: 'active',
    acknowledged_at: null,
    resolved_at: null,
    expires_at: null,
  }
}

/**
 * Calculate expiration date for a resolved alert
 */
export function calculateAlertExpiration(resolvedAt: Date, code: AlertCode): Date {
  const metadata = ALERT_METADATA[code]
  const expiresAt = new Date(resolvedAt)
  expiresAt.setDate(expiresAt.getDate() + metadata.ttlDaysAfterResolution)
  return expiresAt
}

/**
 * Check if an alert should be auto-acknowledged (e.g., info alerts)
 */
export function shouldAutoAcknowledge(code: AlertCode): boolean {
  const autoAckCodes: AlertCode[] = [
    'STATUS_CHANGED',
    'PROCESS_CREATED',
    'VESSEL_DEPARTURE',
    'VESSEL_ARRIVAL',
  ]
  return autoAckCodes.includes(code)
}
