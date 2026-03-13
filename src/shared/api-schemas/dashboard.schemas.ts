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

const NavbarAlertMessageSchema = z.discriminatedUnion('message_key', [
  z.object({
    message_key: z.literal('alerts.transshipmentDetected'),
    message_params: z
      .object({
        port: z.string(),
        fromVessel: z.string(),
        toVessel: z.string(),
      })
      .strict(),
  }),
  z.object({
    message_key: z.literal('alerts.customsHoldDetected'),
    message_params: z
      .object({
        location: z.string(),
      })
      .strict(),
  }),
  z.object({
    message_key: z.literal('alerts.noMovementDetected'),
    message_params: z
      .object({
        threshold_days: z.number(),
        days_without_movement: z.number(),
        days: z.number(),
        lastEventDate: z.string(),
      })
      .strict(),
  }),
  z.object({
    message_key: z.literal('alerts.etaMissing'),
    message_params: z.object({}).strict(),
  }),
  z.object({
    message_key: z.literal('alerts.etaPassed'),
    message_params: z.object({}).strict(),
  }),
  z.object({
    message_key: z.literal('alerts.portChange'),
    message_params: z.object({}).strict(),
  }),
  z.object({
    message_key: z.literal('alerts.dataInconsistent'),
    message_params: z.object({}).strict(),
  }),
])

const NavbarAlertItemResponseSchema = z
  .object({
    alert_id: z.string(),
    severity: z.enum(['danger', 'warning', 'info']),
    category: z.enum(['fact', 'monitoring']),
    occurred_at: z.string(),
    retroactive: z.boolean(),
  })
  .and(NavbarAlertMessageSchema)

const NavbarContainerAlertGroupResponseSchema = z.object({
  container_id: z.string(),
  container_number: z.string(),
  status: z.string().nullable(),
  eta: z.string().nullable(),
  active_alerts_count: z.number(),
  dominant_severity: DashboardProcessExceptionSeverityResponseSchema,
  latest_alert_at: z.string().nullable(),
  alerts: z.array(NavbarAlertItemResponseSchema),
})

const NavbarProcessAlertGroupResponseSchema = z.object({
  process_id: z.string(),
  process_reference: z.string().nullable(),
  carrier: z.string().nullable(),
  route_summary: z.string(),
  active_alerts_count: z.number(),
  dominant_severity: DashboardProcessExceptionSeverityResponseSchema,
  latest_alert_at: z.string().nullable(),
  containers: z.array(NavbarContainerAlertGroupResponseSchema),
})

export const NavbarAlertsSummaryResponseSchema = z.object({
  generated_at: z.string(),
  total_active_alerts: z.number(),
  processes: z.array(NavbarProcessAlertGroupResponseSchema),
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
export type NavbarAlertsSummaryResponse = z.infer<typeof NavbarAlertsSummaryResponseSchema>
export type DashboardKpisResponse = z.infer<typeof DashboardKpisResponseSchema>
export type DashboardProcessesCreatedByMonthResponse = z.infer<
  typeof DashboardProcessesCreatedByMonthResponseSchema
>
export type DashboardProcessesCreatedByMonthQuery = z.infer<
  typeof DashboardProcessesCreatedByMonthQuerySchema
>
