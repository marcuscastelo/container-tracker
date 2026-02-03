import { z } from 'zod'

/*
  Alerting and enum documentation schema
  - Defines canonical enums / alert types / severity levels / stage names used by the UI
  - This file is primarily documentation+types to keep alert rules consistent
*/

// Severity levels used in the UI for alerts
export const AlertSeverity = z.enum(['info', 'warning', 'danger'])
export type AlertSeverity = z.infer<typeof AlertSeverity>

// Canonical event types (normalize provider-specific activity strings into these)
export const EventType = z.enum([
  'gate', // gate in/out
  'load', // loaded on vessel
  'discharge', // discharged from vessel
  'departure', // vessel departure
  'arrival', // vessel arrival / container arrival
  'customs', // customs event
  'delivery', // delivered / released
  'other',
])
export type EventType = z.infer<typeof EventType>

// Alert categories: higher level grouping for UI badges/panel
export const AlertCategory = z.enum([
  'eta', // ETA related (arrivals, delays)
  'movement', // loading/unloading/gate
  'customs',
  'status', // container status change
  'data', // missing data / parsing problems
])
export type AlertCategory = z.infer<typeof AlertCategory>

// Alert shape used across the app
export const AlertSchema = z.object({
  id: z.string(),
  severity: AlertSeverity,
  category: AlertCategory,
  message: z.string(),
  timestamp: z.string().nullable().optional(), // ISO string when available
  container: z.string().nullable().optional(),
  bl: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export type Alert = z.infer<typeof AlertSchema>

// Mapping hints (documented as constants) used by adapters
export const ActivityToEventType = z.record(z.string(), EventType)

export default {
  AlertSeverity,
  EventType,
  AlertCategory,
  AlertSchema,
  ActivityToEventType,
}
