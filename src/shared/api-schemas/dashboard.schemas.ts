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

export type DashboardGlobalAlertsSummaryResponse = z.infer<
  typeof DashboardGlobalAlertsSummaryResponseSchema
>
