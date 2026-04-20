import type { useNavigate } from '@solidjs/router'
import type { Accessor } from 'solid-js'
import { createEffect, createSignal } from 'solid-js'
import { clearDashboardPrefetchCache } from '~/modules/process/ui/api/process.api'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { clearPrefetchedProcessDetailById } from '~/modules/process/ui/fetchProcess'
import {
  toCreateErrorExisting,
  toCreateErrorMessage,
  toEditInitialData,
} from '~/modules/process/ui/screens/shipment/lib/shipmentEdit.mapper'
import { submitCreateProcess } from '~/modules/process/ui/screens/shipment/usecases/submitCreateProcess.usecase'
import { submitEditProcess } from '~/modules/process/ui/screens/shipment/usecases/submitEditProcess.usecase'
import type { ExistingProcessConflict } from '~/modules/process/ui/validation/processConflict.validation'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { navigateToProcess } from '~/shared/ui/navigation/app-navigation'

type UseShipmentDialogsControllerCommand = {
  readonly processId: Accessor<string>
  readonly navigate: ReturnType<typeof useNavigate>
  readonly refetchShipment: () => unknown
}

type ShipmentDialogsControllerResult = {
  readonly isEditOpen: Accessor<boolean>
  readonly closeEditDialog: () => void
  readonly editInitialData: Accessor<CreateProcessDialogFormData | null>
  readonly focusFieldOnOpen: Accessor<'reference' | 'carrier' | null>
  readonly handleEditSubmit: (formData: CreateProcessDialogFormData) => Promise<void> // i18n-enforce-ignore
  readonly isCreateDialogOpen: Accessor<boolean>
  readonly closeCreateDialog: () => void
  readonly openCreateDialog: () => void
  readonly handleCreateSubmit: (formData: CreateProcessDialogFormData) => Promise<void> // i18n-enforce-ignore
  readonly hasCreateError: Accessor<boolean>
  readonly createErrorMessage: Accessor<string>
  readonly createErrorExisting: Accessor<ExistingProcessConflict | undefined>
  readonly clearCreateError: () => void
  readonly openEditForShipment: (
    shipmentData: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => void
}

export function useShipmentDialogsController(
  command: UseShipmentDialogsControllerCommand,
): ShipmentDialogsControllerResult {
  const [isEditOpen, setIsEditOpen] = createSignal(false)
  const [editInitialDataValue, setEditInitialData] =
    createSignal<CreateProcessDialogFormData | null>(null)
  const [focusFieldOnOpen, setFocusFieldOnOpen] = createSignal<'reference' | 'carrier' | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

  createEffect(() => {
    command.processId()
    setIsEditOpen(false)
    setEditInitialData(null)
    setFocusFieldOnOpen(null)
    setIsCreateDialogOpen(false)
    setCreateError(null)
  })

  const handleCreateSubmit = async (formData: CreateProcessDialogFormData) => {
    const result = await submitCreateProcess(formData)

    if (result.kind === 'created') {
      clearDashboardPrefetchCache()
      setIsCreateDialogOpen(false)
      navigateToProcess({
        navigate: command.navigate,
        processId: result.processId,
      })
      return
    }

    if (result.kind === 'conflict') {
      setIsCreateDialogOpen(false)
      setCreateError(result.error)
      return
    }

    setCreateError(result.message)
    setIsCreateDialogOpen(false)
  }

  const handleEditSubmit = async (formData: CreateProcessDialogFormData) => {
    const currentProcessId = command.processId()
    const result = await submitEditProcess(currentProcessId, formData)

    if (result.kind === 'updated') {
      clearPrefetchedProcessDetailById(currentProcessId)
      clearDashboardPrefetchCache()
      await command.refetchShipment()
      setIsEditOpen(false)
      return
    }

    if (result.kind === 'conflict') {
      setIsEditOpen(false)
      setCreateError(result.error)
      return
    }

    setCreateError(result.message)
    setIsEditOpen(false)
  }

  const openEditForShipment = (
    shipmentData: ShipmentDetailVM,
    focus?: 'reference' | 'carrier' | null | undefined,
  ) => {
    const initialData = toEditInitialData(shipmentData)
    setEditInitialData(initialData)

    if (focus === 'carrier') {
      setFocusFieldOnOpen('carrier')
    } else if (focus === 'reference') {
      setFocusFieldOnOpen('reference')
    } else {
      setFocusFieldOnOpen(null)
    }

    setIsEditOpen(true)
  }

  return {
    isEditOpen,
    closeEditDialog: () => {
      setIsEditOpen(false)
      setFocusFieldOnOpen(null)
    },
    editInitialData: editInitialDataValue,
    focusFieldOnOpen,
    handleEditSubmit,
    isCreateDialogOpen,
    closeCreateDialog: () => setIsCreateDialogOpen(false),
    openCreateDialog: () => setIsCreateDialogOpen(true),
    handleCreateSubmit,
    hasCreateError: () => Boolean(createError()),
    createErrorMessage: () => toCreateErrorMessage(createError()),
    createErrorExisting: () => toCreateErrorExisting(createError()),
    clearCreateError: () => setCreateError(null),
    openEditForShipment,
  }
}
