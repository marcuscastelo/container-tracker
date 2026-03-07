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

export type DashboardGlobalAlertsSummaryResponse = z.infer<
  typeof DashboardGlobalAlertsSummaryResponseSchema
>
export type DashboardOperationalSummaryResponse = z.infer<
  typeof DashboardOperationalSummaryResponseSchema
>
