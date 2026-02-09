import {
  buildCreateProcessInput,
  CanonicalShipmentSchema,
  createInitialAlerts,
  reconcileProcessOnCreateError,
} from '~/modules/container-events/infrastructure/api/refresh/helpers'
import { processUseCases } from '~/modules/process'

export async function ingestCanonicalShipment(canonicalStatus: unknown, container: string) {
  try {
    const parsed = CanonicalShipmentSchema.safeParse(canonicalStatus)
    if (!parsed.success) {
      console.warn('refresh: canonical shipment schema validation failed', parsed.error.format())
      return
    }
    const shipment = parsed.data
    const containers = shipment.containers

    if (containers.length > 0) {
      const createInput = buildCreateProcessInput(shipment)
      try {
        const res = await processUseCases.createProcess(createInput)
        console.log(`refresh: created process ${res.process.id} for container ${container}`)
        await createInitialAlerts(res.process.id, res.containers)
      } catch (createErr: unknown) {
        await reconcileProcessOnCreateError(createErr, container, createInput)
      }
    }
  } catch (ingestErr) {
    console.warn('refresh: ingesting canonical shipment into processes failed', ingestErr)
  }
}
