import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { toReadableErrorMessage } from '~/modules/process/ui/screens/shipment/lib/shipmentError.presenter'
import {
  createProcessRequest,
  toCreateProcessInput,
} from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'

export type SubmitCreateProcessResult =
  | { readonly kind: 'created'; readonly processId: string }
  | { readonly kind: 'conflict'; readonly error: ExistingProcessConflict }
  | { readonly kind: 'error'; readonly message: string }

export async function submitCreateProcess(
  formData: CreateProcessDialogFormData,
): Promise<SubmitCreateProcessResult> {
  try {
    try {
      const resultId = await createProcessRequest(toCreateProcessInput(formData))
      return { kind: 'created', processId: resultId }
    } catch (err) {
      const conflict = parseExistingProcessConflictError(err)
      if (conflict) {
        return { kind: 'conflict', error: conflict }
      }
      throw err
    }
  } catch (err) {
    console.error('Failed to create process:', err)
    return { kind: 'error', message: toReadableErrorMessage(err) }
  }
}
