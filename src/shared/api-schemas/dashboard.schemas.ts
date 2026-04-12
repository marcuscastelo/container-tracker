import { z } from 'zod'
import { TemporalValueDtoSchema } from '~/shared/api-schemas/temporal.schemas'

const DashboardGlobalAlertsBySeverityResponseSchema = z.object({
  danger: z.number(),
  warning: z.number(),
  info: z.number(),
})

const DashboardGlobalAlertsByCategoryResponseSchema = z.object({
  eta: z.number(),
  movement: z.number(),
  customs: z.number(),
  data: z.number(),
})

const DashboardGlobalAlertsSummaryResponseSchema = z.object({
  generated_at: z.string(),
  total_active_incidents: z.number(),
  affected_containers_count: z.number(),
  recognized_incidents_count: z.number(),
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
  eta_current: TemporalValueDtoSchema.nullable(),
  dominant_severity: DashboardProcessExceptionSeverityResponseSchema,
  active_incident_count: z.number(),
  affected_container_count: z.number(),
  dominant_incident: z
    .object({
      type: z.enum([
        'TRANSSHIPMENT',
        'PLANNED_TRANSSHIPMENT',
        'CUSTOMS_HOLD',
        'PORT_CHANGE',
        'ETA_PASSED',
        'ETA_MISSING',
        'DATA_INCONSISTENT',
      ]),
      severity: z.enum(['info', 'warning', 'danger']),
      fact: z.object({
        message_key: z.string(),
        message_params: z.record(z.string(), z.union([z.string(), z.number()])),
      }),
      triggered_at: z.string(),
    })
    .nullable(),
})

export const DashboardOperationalSummaryResponseSchema =
  DashboardGlobalAlertsSummaryResponseSchema.extend({
    process_exceptions: z.array(DashboardProcessExceptionResponseSchema),
  })

const NavbarIncidentItemResponseSchema = z.object({
  incident_key: z.string(),
  type: z.enum([
    'TRANSSHIPMENT',
    'PLANNED_TRANSSHIPMENT',
    'CUSTOMS_HOLD',
    'PORT_CHANGE',
    'ETA_PASSED',
    'ETA_MISSING',
    'DATA_INCONSISTENT',
  ]),
  category: z.enum(['movement', 'eta', 'customs', 'data']),
  severity: z.enum(['danger', 'warning', 'info']),
  fact: z.object({
    message_key: z.string(),
    message_params: z.record(z.string(), z.union([z.string(), z.number()])),
  }),
  action: z
    .object({
      action_key: z.string(),
      action_params: z.record(z.string(), z.union([z.string(), z.number()])),
      action_kind: z.enum([
        'UPDATE_REDESTINATION',
        'CHECK_ETA',
        'FOLLOW_UP_CUSTOMS',
        'REVIEW_DATA',
      ]),
    })
    .nullable(),
  affected_container_count: z.number(),
  triggered_at: z.string(),
  containers: z.array(
    z.object({
      container_id: z.string(),
      container_number: z.string(),
      lifecycle_state: z.enum(['ACTIVE', 'ACKED', 'AUTO_RESOLVED']),
    }),
  ),
})

const NavbarProcessAlertGroupResponseSchema = z.object({
  process_id: z.string(),
  process_reference: z.string().nullable(),
  carrier: z.string().nullable(),
  route_summary: z.string(),
  active_incident_count: z.number(),
  affected_container_count: z.number(),
  dominant_severity: DashboardProcessExceptionSeverityResponseSchema,
  latest_incident_at: z.string().nullable(),
  incidents: z.array(NavbarIncidentItemResponseSchema),
})

export const NavbarAlertsSummaryResponseSchema = z.object({
  generated_at: z.string(),
  total_active_incidents: z.number(),
  processes: z.array(NavbarProcessAlertGroupResponseSchema),
})

export const DashboardKpisResponseSchema = z.object({
  activeProcesses: z.number(),
  trackedContainers: z.number(),
  activeIncidents: z.number(),
  affectedContainers: z.number(),
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
