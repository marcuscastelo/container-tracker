import { typedFetch } from '~/shared/api/typedFetch'
import {
  type DashboardKpisResponse,
  DashboardKpisResponseSchema,
} from '~/shared/api-schemas/dashboard.schemas'

const DASHBOARD_KPIS_ENDPOINT = '/api/dashboard/kpis'

export async function fetchDashboardKpis(): Promise<DashboardKpisResponse> {
  return typedFetch(DASHBOARD_KPIS_ENDPOINT, undefined, DashboardKpisResponseSchema)
}
