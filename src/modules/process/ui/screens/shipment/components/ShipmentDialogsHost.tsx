import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialogs } from '~/modules/process/ui/components/CreateProcessDialogs'
import type { ExistingProcessConflict } from '~/modules/process/ui/validation/processConflict.validation'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

type ShipmentDialogsHostProps = {
  readonly isEditOpen: Accessor<boolean>
  readonly onCloseEdit: () => void
  readonly editInitialData: Accessor<CreateProcessDialogFormData | null>
  readonly focusFieldOnOpen: Accessor<'reference' | 'carrier' | null>
  readonly onEditSubmit: (formData: CreateProcessDialogFormData) => Promise<void>
  readonly isCreateDialogOpen: Accessor<boolean>
  readonly onCloseCreate: () => void
  readonly onCreateSubmit: (formData: CreateProcessDialogFormData) => Promise<void>
  readonly hasCreateError: Accessor<boolean>
  readonly createErrorMessage: Accessor<string>
  readonly createErrorExisting: Accessor<ExistingProcessConflict | undefined>
  readonly onAcknowledgeCreateError: () => void
}

export function ShipmentDialogsHost(props: ShipmentDialogsHostProps) {
  return (
    <>
      <CreateProcessDialogs
        openEdit={props.isEditOpen()}
        onCloseEdit={props.onCloseEdit}
        initialData={props.editInitialData()}
        onEditSubmit={props.onEditSubmit}
        openCreate={props.isCreateDialogOpen()}
        onCloseCreate={props.onCloseCreate}
        onCreateSubmit={props.onCreateSubmit}
      />

      <Show when={props.hasCreateError()}>
        <ExistingProcessError
          message={props.createErrorMessage()}
          existing={props.createErrorExisting()}
          onAcknowledge={props.onAcknowledgeCreateError}
        />
      </Show>
    </>
  )
}
