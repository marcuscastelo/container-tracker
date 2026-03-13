import { z } from 'zod'

const DashboardGlobalAlertsBySeverityResponseSchema = z.object({
  danger: z.number(),
  warning: z.number(),
  info: z.number(),
  success: z.number(),
})

const DashboardGlobalAlertsByCategoryResponseSchema = z.object({
  eta: z.number(),
  movement: z.number(),
  customs: z.number(),
  status: z.number(),
  data: z.number(),
})

const DashboardGlobalAlertsSummaryResponseSchema = z.object({
  generated_at: z.string(),
  total_active_alerts: z.number(),
  by_severity: DashboardGlobalAlertsBySeverityResponseSchema,
  by_category: DashboardGlobalAlertsByCategoryResponseSchema,
})

const DashboardProcessExceptionSeverityResponseSchema = z.enum([
  'danger',
  'warning',
  'info',
  'success',
  'none',
])

const DashboardProcessExceptionResponseSchema = z.object({
  process_id: z.string(),
  reference: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  derived_status: z.string(),
  eta_current: z.string().nullable(),
  dominant_severity: DashboardProcessExceptionSeverityResponseSchema,
  dominant_alert_created_at: z.string().nullable(),
  active_alert_count: z.number(),
})

export const DashboardOperationalSummaryResponseSchema =
  DashboardGlobalAlertsSummaryResponseSchema.extend({
    process_exceptions: z.array(DashboardProcessExceptionResponseSchema),
  })

export const DashboardKpisResponseSchema = z.object({
  activeProcesses: z.number(),
  trackedContainers: z.number(),
  processesWithAlerts: z.number(),
  lastSyncAt: z.string().nullable(),
})

const DashboardProcessesCreatedByMonthDatumResponseSchema = z.object({
  month: z.string(),
  label: z.string(),
  count: z.number(),
})

export const DashboardProcessesCreatedByMonthResponseSchema = z.object({
  months: z.array(DashboardProcessesCreatedByMonthDatumResponseSchema),
})

export const DashboardProcessesCreatedByMonthQuerySchema = z.object({
  window: z.enum(['6', '12', '24']).optional(),
})

export type DashboardGlobalAlertsSummaryResponse = z.infer<
  typeof DashboardGlobalAlertsSummaryResponseSchema
>
export type DashboardOperationalSummaryResponse = z.infer<
  typeof DashboardOperationalSummaryResponseSchema
>
export type DashboardKpisResponse = z.infer<typeof DashboardKpisResponseSchema>
export type DashboardProcessesCreatedByMonthResponse = z.infer<
  typeof DashboardProcessesCreatedByMonthResponseSchema
>
export type DashboardProcessesCreatedByMonthQuery = z.infer<
  typeof DashboardProcessesCreatedByMonthQuerySchema
>
