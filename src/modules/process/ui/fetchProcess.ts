import type {
  ProcessApiResponse,
  ShipmentDetail,
} from '~/modules/process/application/processPresenter'
import { presentProcess } from '~/modules/process/application/processPresenter'

export async function fetchProcess(id: string): Promise<ShipmentDetail | null> {
  const response = await fetch(`/api/processes/${id}`)
  if (!response.ok) {
    if (response.status === 404) return null
    throw new Error(`Failed to fetch process: ${response.statusText}`)
  }
  const data: ProcessApiResponse = await response.json()
  return presentProcess(data)
}
