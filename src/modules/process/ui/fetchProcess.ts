import { presentProcess } from '~/modules/process/application/processPresenter'
import type { ShipmentDetail } from '~/modules/process/application/uiTypes'
import { typedFetch } from '~/shared/api/typedFetch'
import { ProcessDetailResponseSchema } from '~/shared/api-schemas/processes.schemas'

export async function fetchProcess(id: string): Promise<ShipmentDetail | null> {
  try {
    const data = await typedFetch(`/api/processes/${id}`, undefined, ProcessDetailResponseSchema)
    return presentProcess(data)
  } catch (err: unknown) {
    // typedFetch throws on non-2xx or schema mismatch; surface 404 as null
    if (err instanceof Error && err.message?.includes('Not Found')) return null
    // If the server returned a 404 with structured body, typedFetch would have thrown; try a fallback fetch to detect 404
    const res = await fetch(`/api/processes/${id}`)
    if (!res.ok && res.status === 404) return null
    throw err
  }
}
