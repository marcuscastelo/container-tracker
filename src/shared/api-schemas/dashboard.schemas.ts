import { z } from 'zod'

export const DashboardGlobalAlertsBySeverityResponseSchema = z.object({
  danger: z.number(),
  warning: z.number(),
  info: z.number(),
  success: z.number(),
})

export const DashboardGlobalAlertsByCategoryResponseSchema = z.object({
  eta: z.number(),
  movement: z.number(),
  customs: z.number(),
  status: z.number(),
  data: z.number(),
})

export const DashboardGlobalAlertsSummaryResponseSchema = z.object({
  total_active_alerts: z.number(),
  by_severity: DashboardGlobalAlertsBySeverityResponseSchema,
  by_category: DashboardGlobalAlertsByCategoryResponseSchema,
})

export const DashboardProcessExceptionSeverityResponseSchema = z.enum([
  'danger',
  'warning',
  'info',
  'success',
  'none',
])

export const DashboardProcessExceptionResponseSchema = z.object({
  process_id: z.string(),
  reference: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  derived_status: z.string(),
  eta_current: z.string().nullable(),
  dominant_severity: DashboardProcessExceptionSeverityResponseSchema,
  active_alert_count: z.number(),
})

export const DashboardOperationalSummaryResponseSchema =
  DashboardGlobalAlertsSummaryResponseSchema.extend({
    process_exceptions: z.array(DashboardProcessExceptionResponseSchema),
  })

export type DashboardGlobalAlertsSummaryResponse = z.infer<
  typeof DashboardGlobalAlertsSummaryResponseSchema
>
export type DashboardProcessExceptionResponse = z.infer<
  typeof DashboardProcessExceptionResponseSchema
>
export type DashboardOperationalSummaryResponse = z.infer<
  typeof DashboardOperationalSummaryResponseSchema
>
