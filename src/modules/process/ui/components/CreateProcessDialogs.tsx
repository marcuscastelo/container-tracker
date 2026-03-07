import type { JSX } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'

export function CreateProcessDialogs(props: {
  openEdit: boolean
  onCloseEdit: () => void
  initialData: CreateProcessDialogFormData | null
  onEditSubmit: (formData: CreateProcessDialogFormData) => Promise<void>
  openCreate: boolean
  onCloseCreate: () => void
  onCreateSubmit: (formData: CreateProcessDialogFormData) => Promise<void>
}) {
  return (
    <>
      <CreateProcessDialog
        open={props.openEdit}
        onClose={props.onCloseEdit}
        initialData={props.initialData}
        mode="edit"
        onSubmit={props.onEditSubmit}
      />
      <CreateProcessDialog
        open={props.openCreate}
        onClose={props.onCloseCreate}
        onSubmit={props.onCreateSubmit}
        mode="create"
      />
    </>
  )
}
