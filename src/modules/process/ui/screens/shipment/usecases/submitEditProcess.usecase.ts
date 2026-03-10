import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { toReadableErrorMessage } from '~/modules/process/ui/screens/shipment/lib/shipmentError.presenter'
import {
  toCreateProcessInput,
  updateProcessRequest,
} from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'

export type SubmitEditProcessResult =
  | { readonly kind: 'updated' }
  | { readonly kind: 'conflict'; readonly error: ExistingProcessConflict }
  | { readonly kind: 'error'; readonly message: string }

export async function submitEditProcess(
  processId: string,
  formData: CreateProcessDialogFormData,
): Promise<SubmitEditProcessResult> {
  try {
    const input = toCreateProcessInput(formData)
    try {
      await updateProcessRequest(processId, input)
      return { kind: 'updated' }
    } catch (err) {
      const conflict = parseExistingProcessConflictError(err)
      if (conflict) {
        return { kind: 'conflict', error: conflict }
      }
      throw err
    }
  } catch (err) {
    console.error('Failed to update process:', err)
    return { kind: 'error', message: toReadableErrorMessage(err) }
  }
}
