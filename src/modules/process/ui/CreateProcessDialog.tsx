import { useNavigate } from '@solidjs/router'
import type { Accessor, JSX, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import { CreateProcessDialogView } from '~/modules/process/ui/CreateProcessDialog.view'
import {
  buildProcessCarrierOptions,
  isProcessDialogCarrier,
  type ProcessDialogCarrier,
} from '~/modules/process/ui/carrierCatalog'
import {
  MAX_CONTAINERS_PER_PASTE,
  mergeBulkPastedContainers,
  parseContainerBulkPaste,
} from '~/modules/process/ui/validation/containerBulkPaste.validation'
import {
  dropContainerScopedField,
  listContainerScopedEntries,
  retainContainerScopedFields,
  toContainerFieldKey,
} from '~/modules/process/ui/validation/containerFormState.validation'
import {
  type CreateProcessCloseGuardFormSnapshot,
  createDefaultCreateProcessCloseGuardFormSnapshot,
  isCreateProcessCloseGuardFormDirty,
  isSmartPasteCloseGuardDirty,
} from '~/modules/process/ui/validation/createProcessCloseGuard.validation'
import {
  type ParsedProcessDraft,
  type ParsedUnmappedField,
  parseTrelloSmartPaste,
} from '~/modules/process/ui/validation/trelloSmartPaste.validation'
import {
  applySmartPasteApplyPlan,
  buildSmartPasteApplyPlan,
  type SmartPasteApplyPlan,
  type SmartPasteFieldConflict,
  type SmartPasteFormSnapshot,
  type SmartPasteScalarField,
} from '~/modules/process/ui/validation/trelloSmartPasteApply.validation'
import { useTranslation } from '~/shared/localization/i18n'
import { navigateToAppHref } from '~/shared/ui/navigation/app-navigation'
import { findDuplicateStrings } from '~/shared/utils/findDuplicateStrings'
import { isRecord } from '~/shared/utils/typeGuards'

type TranslationApi = ReturnType<typeof useTranslation>

type Carrier = ProcessDialogCarrier

export type ContainerInput = {
  readonly id: string
  containerNumber: string
}

export type CreateProcessDialogFormData = {
  reference: string
  origin: string
  destination: string
  containers: ContainerInput[]
  carrier: Carrier
  billOfLading: string
  bookingNumber: string
  importerName: string
  exporterName: string
  referenceImporter: string
  product: string
  redestinationNumber: string
}

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit?: (data: CreateProcessDialogFormData) => void
  readonly initialData?: CreateProcessDialogFormData | null
  readonly mode?: 'create' | 'edit'
  readonly focus?: 'reference' | 'carrier' | null | undefined
}

type ContainerConflict = {
  readonly containerNumber: string
  readonly link?: string
  readonly message?: string
}

type FieldError = {
  readonly message: string
  readonly link?: string
}

type SubmitValidationResult =
  | { readonly type: 'ready'; readonly data: CreateProcessDialogFormData }
  | { readonly type: 'blocked'; readonly errors: Record<string, FieldError> }
  | { readonly type: 'invalid-carrier' }

type BuildFormDataInput = {
  readonly reference: string
  readonly origin: string
  readonly destination: string
  readonly containers: readonly ContainerInput[]
  readonly carrier: Carrier
  readonly billOfLading: string
  readonly bookingNumber: string
  readonly importerName: string
  readonly exporterName: string
  readonly referenceImporter: string
  readonly product: string
  readonly redestinationNumber: string
}

type FormFieldSetters = {
  readonly setReference: Setter<string>
  readonly setOrigin: Setter<string>
  readonly setDestination: Setter<string>
  readonly setContainers: SetStoreFunction<ContainerInput[]>
  readonly setCarrier: Setter<Carrier | ''>
  readonly setBillOfLading: Setter<string>
  readonly setBookingNumber: Setter<string>
  readonly setImporterName: Setter<string>
  readonly setExporterName: Setter<string>
  readonly setReferenceImporter: Setter<string>
  readonly setProduct: Setter<string>
  readonly setRedestinationNumber: Setter<string>
}

type DialogStateSetters = FormFieldSetters & {
  readonly setTouched: Setter<Record<string, boolean>>
  readonly setServerErrors: Setter<Record<string, FieldError>>
}

type CreateContainerBlurHandlerParams = {
  readonly markTouched: (fieldKey: string) => void
  readonly getContainers: Accessor<readonly ContainerInput[]>
  readonly initialContainerNumbers: Accessor<ReadonlySet<string>>
  readonly setServerErrors: Setter<Record<string, FieldError>>
  readonly validationTracker: ContainerValidationTracker
}

type CreateContainerPasteHandlerParams = {
  readonly getContainers: Accessor<readonly ContainerInput[]>
  readonly setContainers: SetStoreFunction<ContainerInput[]>
  readonly markTouched: (fieldKey: string) => void
  readonly setServerErrors: Setter<Record<string, FieldError>>
  readonly validationTracker: ContainerValidationTracker
  readonly pasteLimitMessage: Accessor<string>
}

type ContainerValidationTracker = {
  readonly start: (containerId: string) => number
  readonly isCurrent: (containerId: string, ticket: number) => boolean
  readonly clear: (containerId: string) => void
  readonly reset: () => void
}

type CreateSubmitHandlerParams = {
  readonly getContainers: Accessor<readonly ContainerInput[]>
  readonly markTouched: (fieldKey: string) => void
  readonly duplicateList: Accessor<readonly string[]>
  readonly getCarrier: Accessor<Carrier | ''>
  readonly buildData: (carrier: Carrier) => CreateProcessDialogFormData
  readonly initialContainerNumbers: Accessor<ReadonlySet<string>>
  readonly setServerErrors: Setter<Record<string, FieldError>>
  readonly onReady: (data: CreateProcessDialogFormData) => void
}

type BuildDialogFormParams = {
  readonly reference: string
  readonly onReferenceInput: (value: string) => void
  readonly importerName: string
  readonly onImporterNameInput: (value: string) => void
  readonly exporterName: string
  readonly onExporterNameInput: (value: string) => void
  readonly referenceImporter: string
  readonly onReferenceImporterInput: (value: string) => void
  readonly product: string
  readonly onProductInput: (value: string) => void
  readonly redestinationNumber: string
  readonly onRedestinationNumberInput: (value: string) => void
  readonly origin: string
  readonly onOriginInput: (value: string) => void
  readonly destination: string
  readonly onDestinationInput: (value: string) => void
  readonly containers: readonly ContainerInput[]
  readonly onUpdateContainer: (id: string, value: string) => void
  readonly onContainerPaste: (container: ContainerInput, event: ClipboardEvent) => void
  readonly onContainerBlur: (container: ContainerInput) => void
  readonly onRemoveContainer: (id: string) => void
  readonly onAddContainer: () => void
  readonly getContainerError: (container: ContainerInput) => string | undefined
  readonly getDuplicateError: (container: ContainerInput) => string | undefined
  readonly getContainerLink: (container: ContainerInput) => string | undefined
  readonly onOpenContainerLink: (container: ContainerInput) => void
  readonly carrier: Carrier | ''
  readonly onCarrierInput: (value: string) => void
  readonly carrierOptions: readonly { readonly value: string; readonly label: string }[]
  readonly billOfLading: string
  readonly onBillOfLadingInput: (value: string) => void
  readonly bookingNumber: string
  readonly onBookingNumberInput: (value: string) => void
}

type CreateContainerFeedbackHandlersParams = {
  readonly containers: Accessor<readonly ContainerInput[]>
  readonly touched: Accessor<Record<string, boolean>>
  readonly serverErrors: Accessor<Record<string, FieldError>>
  readonly containerRequiredMessage: Accessor<string>
  readonly duplicateContainerMessage: Accessor<string>
  readonly confirmLoseProgressMessage: Accessor<string>
  readonly navigateToAppLink: (href: string) => void
}

type SmartPasteDetectedField = {
  readonly label: string
  readonly value: string
}

type SmartPasteConflictView = {
  readonly fieldLabel: string
  readonly currentValue: string
  readonly importedValue: string
}

type CloseGuardTarget = 'form' | 'smartPaste'

type CloseGuardViewModel = {
  readonly open: boolean
  readonly target: CloseGuardTarget | null
}

type SmartPasteViewModel = {
  readonly enabled: boolean
  readonly open: boolean
  readonly rawText: string
  readonly hasParsed: boolean
  readonly hasContainersDetected: boolean
  readonly detectedFields: readonly SmartPasteDetectedField[]
  readonly detectedContainers: readonly string[]
  readonly unmappedFields: readonly ParsedUnmappedField[]
  readonly warnings: readonly string[]
  readonly conflicts: readonly SmartPasteConflictView[]
  readonly applyErrorMessage: string
  readonly onOpen: () => void
  readonly onClose: () => void
  readonly onTextInput: (value: string) => void
  readonly onAnalyze: () => void
  readonly onApply: () => void
  readonly onCancelOverwrite: () => void
  readonly onConfirmOverwrite: () => void
}

type CreateSmartPasteControllerParams = {
  readonly open: Accessor<boolean>
  readonly mode: Accessor<Props['mode']>
  readonly state: DialogState
  readonly t: TranslationApi['t']
  readonly keys: TranslationApi['keys']
  readonly onCloseRequest: () => void
}

type SmartPasteController = {
  readonly smartPaste: Accessor<SmartPasteViewModel>
  readonly overwriteConfirmOpen: Accessor<boolean>
  readonly open: Accessor<boolean>
  readonly hasUnsavedDraft: Accessor<boolean>
  readonly forceClose: () => void
  readonly reset: () => void
}

type CreateCloseGuardControllerParams = {
  readonly open: Accessor<boolean>
  readonly mode: Accessor<'create' | 'edit'>
  readonly initialData: Accessor<CreateProcessDialogFormData | null | undefined>
  readonly state: DialogState
  readonly smartPasteController: SmartPasteController
  readonly onForceClose: () => void
}

type CloseGuardController = {
  readonly closeGuard: Accessor<CloseGuardViewModel>
  readonly requestDialogClose: () => void
  readonly requestSmartPasteClose: () => void
  readonly cancelCloseGuard: () => void
  readonly confirmCloseGuard: () => void
  readonly closeDialogForce: () => void
}

type DialogState = {
  readonly reference: Accessor<string>
  readonly setReference: Setter<string>
  readonly origin: Accessor<string>
  readonly setOrigin: Setter<string>
  readonly destination: Accessor<string>
  readonly setDestination: Setter<string>
  readonly containers: ContainerInput[]
  readonly setContainers: SetStoreFunction<ContainerInput[]>
  readonly carrier: Accessor<Carrier | ''>
  readonly setCarrier: Setter<Carrier | ''>
  readonly billOfLading: Accessor<string>
  readonly setBillOfLading: Setter<string>
  readonly bookingNumber: Accessor<string>
  readonly setBookingNumber: Setter<string>
  readonly importerName: Accessor<string>
  readonly setImporterName: Setter<string>
  readonly exporterName: Accessor<string>
  readonly setExporterName: Setter<string>
  readonly referenceImporter: Accessor<string>
  readonly setReferenceImporter: Setter<string>
  readonly product: Accessor<string>
  readonly setProduct: Setter<string>
  readonly redestinationNumber: Accessor<string>
  readonly setRedestinationNumber: Setter<string>
  readonly touched: Accessor<Record<string, boolean>>
  readonly setTouched: Setter<Record<string, boolean>>
  readonly serverErrors: Accessor<Record<string, FieldError>>
  readonly setServerErrors: Setter<Record<string, FieldError>>
}

type CreateDialogFormMemoParams = {
  readonly state: DialogState
  readonly carrierOptions: Accessor<readonly { readonly value: Carrier; readonly label: string }[]>
  readonly onUpdateContainer: (id: string, value: string) => void
  readonly onContainerPaste: (container: ContainerInput, event: ClipboardEvent) => void
  readonly onContainerBlur: (container: ContainerInput) => void
  readonly onRemoveContainer: (id: string) => void
  readonly onAddContainer: () => void
  readonly getContainerError: (container: ContainerInput) => string | undefined
  readonly getDuplicateError: (container: ContainerInput) => string | undefined
  readonly getContainerLink: (container: ContainerInput) => string | undefined
  readonly onOpenContainerLink: (container: ContainerInput) => void
  readonly onCarrierInput: (value: string) => void
}

const DEFAULT_SERVER_ERROR = 'Failed to validate container'

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function createEmptyContainer(): ContainerInput {
  return { id: generateId(), containerNumber: '' }
}

function normalizeContainerNumber(value: string): string {
  return value.toUpperCase().trim()
}

function hasValidContainers(containers: readonly ContainerInput[]): boolean {
  return containers.some((container) => container.containerNumber.trim().length > 0)
}

function buildContainerNumbers(containers: readonly ContainerInput[]): readonly string[] {
  return containers
    .map((container) => container.containerNumber.trim())
    .filter((value) => value.length > 0)
}

function buildFormData(input: BuildFormDataInput): CreateProcessDialogFormData {
  return {
    reference: input.reference,
    origin: input.origin,
    destination: input.destination,
    containers: input.containers.filter((container) => container.containerNumber.trim()),
    carrier: input.carrier,
    billOfLading: input.billOfLading,
    bookingNumber: input.bookingNumber,
    importerName: input.importerName,
    exporterName: input.exporterName,
    referenceImporter: input.referenceImporter,
    product: input.product,
    redestinationNumber: input.redestinationNumber,
  }
}

function buildGenericErrors(
  containers: readonly ContainerInput[],
  message: string,
): Record<string, FieldError> {
  return Object.fromEntries(
    containers.map((container) => [toContainerFieldKey(container.id), { message }]),
  )
}

function buildConflictErrors(
  conflicts: readonly ContainerConflict[],
  entriesToCheck: readonly { readonly id: string; readonly normalized: string }[],
): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {}
  for (const conflict of conflicts) {
    const match = entriesToCheck.find(
      (entry) => entry.normalized === normalizeContainerNumber(conflict.containerNumber),
    )
    const fieldKey = match
      ? toContainerFieldKey(match.id)
      : toContainerFieldKey(conflict.containerNumber)
    const link = conflict.link
    errors[fieldKey] = {
      message: conflict.message ?? `Container ${conflict.containerNumber} already exists`,
      ...(link === undefined ? {} : { link }),
    }
  }
  return errors
}

function toContainerConflictsFromPayload(payload: unknown): readonly ContainerConflict[] {
  if (!isRecord(payload)) return []
  if (!Array.isArray(payload.conflicts)) return []

  const conflicts: ContainerConflict[] = []
  for (const item of payload.conflicts) {
    if (!isRecord(item)) continue
    if (typeof item.containerNumber !== 'string' || item.containerNumber.trim().length === 0) {
      continue
    }

    conflicts.push({
      containerNumber: item.containerNumber,
      ...(typeof item.link === 'string' ? { link: item.link } : {}),
      ...(typeof item.message === 'string' ? { message: item.message } : {}),
    })
  }

  return conflicts
}

function toErrorMessageFromPayload(payload: unknown): string | null {
  if (!isRecord(payload)) return null

  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message
  }

  if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error
  }

  if (Array.isArray(payload.duplicates)) {
    const duplicates = payload.duplicates.filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    )
    if (duplicates.length > 0) {
      return `Duplicate container numbers in request: ${duplicates.join(', ')}`
    }
  }

  return null
}

async function requestContainerConflicts(
  containerNumbers: readonly string[],
): Promise<
  | { readonly ok: true; readonly conflicts: readonly ContainerConflict[] }
  | { readonly ok: false; readonly message: string }
> {
  const response = await fetch('/api/containers/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ containers: containerNumbers }),
  })
  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false, message: toErrorMessageFromPayload(payload) ?? DEFAULT_SERVER_ERROR }
  }

  return {
    ok: true,
    conflicts: toContainerConflictsFromPayload(payload),
  }
}

async function validateSubmitWithServerCheck(params: {
  readonly containers: readonly ContainerInput[]
  readonly initialContainerNumbers: ReadonlySet<string>
  readonly carrier: Carrier | ''
  readonly buildData: (carrier: Carrier) => CreateProcessDialogFormData
}): Promise<SubmitValidationResult> {
  if (!isProcessDialogCarrier(params.carrier)) return { type: 'invalid-carrier' }

  const entries = params.containers
    .map((container) => {
      const trimmed = container.containerNumber.trim()
      if (!trimmed) return null

      return {
        normalized: normalizeContainerNumber(trimmed),
        id: container.id,
      }
    })
    .filter(
      (
        entry,
      ): entry is {
        readonly normalized: string
        readonly id: string
      } => entry !== null,
    )

  const entriesToCheck = entries.filter(
    (entry) => !params.initialContainerNumbers.has(entry.normalized),
  )
  if (entriesToCheck.length === 0) {
    return { type: 'ready', data: params.buildData(params.carrier) }
  }

  const checkResult = await requestContainerConflicts(
    entriesToCheck.map((entry) => entry.normalized),
  )
  if (!checkResult.ok) {
    return {
      type: 'blocked',
      errors: buildGenericErrors(params.containers, checkResult.message),
    }
  }

  if (checkResult.conflicts.length > 0) {
    return {
      type: 'blocked',
      errors: buildConflictErrors(checkResult.conflicts, entriesToCheck),
    }
  }

  return { type: 'ready', data: params.buildData(params.carrier) }
}

function focusInitialField(focus: Props['focus']): void {
  if (!focus) return

  setTimeout(() => {
    try {
      if (focus === 'reference') {
        const element = document.getElementById('reference')
        if (element instanceof HTMLInputElement) {
          element.focus()
          element.select()
        }
        return
      }

      const element = document.getElementById('carrier')
      if (element instanceof HTMLSelectElement) {
        element.focus()
      }
    } catch {
      /* ignore focus errors */
    }
  }, 0)
}

function populateFormFromInitialData(params: {
  readonly open: boolean
  readonly initialData?: CreateProcessDialogFormData | null
  readonly focus: Props['focus']
  readonly setters: FormFieldSetters
}): void {
  if (!params.open || !params.initialData) return

  const data = params.initialData
  params.setters.setReference(data.reference || '')
  params.setters.setOrigin(data.origin || '')
  params.setters.setDestination(data.destination || '')
  params.setters.setCarrier(data.carrier || '')
  params.setters.setBillOfLading(data.billOfLading || '')
  params.setters.setBookingNumber(data.bookingNumber || '')
  params.setters.setImporterName(data.importerName || '')
  params.setters.setExporterName(data.exporterName || '')
  params.setters.setReferenceImporter(data.referenceImporter || '')
  params.setters.setProduct(data.product || '')
  params.setters.setRedestinationNumber(data.redestinationNumber || '')
  params.setters.setContainers(
    data.containers.length
      ? data.containers.map((container) => ({
          id: container.id,
          containerNumber: container.containerNumber,
        }))
      : [createEmptyContainer()],
  )
  focusInitialField(params.focus)
}

function resetDialogState(setters: DialogStateSetters): void {
  setters.setReference('')
  setters.setOrigin('')
  setters.setDestination('')
  setters.setContainers([createEmptyContainer()])
  setters.setCarrier('')
  setters.setBillOfLading('')
  setters.setBookingNumber('')
  setters.setImporterName('')
  setters.setExporterName('')
  setters.setReferenceImporter('')
  setters.setProduct('')
  setters.setRedestinationNumber('')
  setters.setTouched({})
  setters.setServerErrors({})
}

function clearContainerServerError(
  setServerErrors: Setter<Record<string, FieldError>>,
  containerId: string,
): void {
  setServerErrors((previous) => dropContainerScopedField(previous, containerId))
}

function clearContainerTouched(
  setTouched: Setter<Record<string, boolean>>,
  containerId: string,
): void {
  setTouched((previous) => dropContainerScopedField(previous, containerId))
}

function markContainersAsTouched(
  containers: readonly ContainerInput[],
  markTouched: (fieldKey: string) => void,
): void {
  for (const container of containers) {
    markTouched(toContainerFieldKey(container.id))
  }
}

function listVisibleContainerServerErrors(
  serverErrors: Readonly<Record<string, FieldError>>,
  containers: readonly ContainerInput[],
): readonly (readonly [string, FieldError])[] {
  return listContainerScopedEntries(
    serverErrors,
    containers.map((container) => container.id),
  )
}

function cloneContainers(containers: readonly ContainerInput[]): ContainerInput[] {
  return containers.map((container) => ({
    id: container.id,
    containerNumber: container.containerNumber,
  }))
}

function findContainerById(
  containers: readonly ContainerInput[],
  containerId: string,
): ContainerInput | undefined {
  return containers.find((container) => container.id === containerId)
}

function applyBulkPasteToContainers(params: {
  readonly containers: readonly ContainerInput[]
  readonly targetContainerId: string
  readonly pastedValues: readonly string[]
}): { readonly nextContainers: ContainerInput[]; readonly appliedValues: string[] } {
  const currentContainers = cloneContainers(params.containers)
  const targetIndex = currentContainers.findIndex(
    (container) => container.id === params.targetContainerId,
  )
  if (targetIndex < 0) {
    return {
      nextContainers: currentContainers,
      appliedValues: [],
    }
  }

  const mergeResult = mergeBulkPastedContainers({
    existingContainerNumbers: currentContainers.map((container) => container.containerNumber),
    targetIndex,
    pastedValues: params.pastedValues,
  })
  if (mergeResult.appliedValues.length === 0) {
    return {
      nextContainers: currentContainers,
      appliedValues: [],
    }
  }

  const targetContainer = currentContainers[targetIndex]
  if (!targetContainer) {
    return {
      nextContainers: currentContainers,
      appliedValues: [],
    }
  }

  const extraCount = mergeResult.appliedValues.length - 1
  const nextContainers: ContainerInput[] = []

  for (let index = 0; index < targetIndex; index += 1) {
    const container = currentContainers[index]
    if (!container) continue
    nextContainers.push({
      id: container.id,
      containerNumber: mergeResult.nextContainerNumbers[index] ?? container.containerNumber,
    })
  }

  nextContainers.push({
    id: targetContainer.id,
    containerNumber:
      mergeResult.nextContainerNumbers[targetIndex] ?? mergeResult.appliedValues[0] ?? '',
  })

  for (let extraIndex = 0; extraIndex < extraCount; extraIndex += 1) {
    const pastedNumber = mergeResult.appliedValues[extraIndex + 1]
    if (!pastedNumber) continue
    nextContainers.push({
      id: generateId(),
      containerNumber: pastedNumber,
    })
  }

  for (let index = targetIndex + 1; index < currentContainers.length; index += 1) {
    const container = currentContainers[index]
    if (!container) continue
    const shiftedIndex = index + extraCount
    nextContainers.push({
      id: container.id,
      containerNumber: mergeResult.nextContainerNumbers[shiftedIndex] ?? container.containerNumber,
    })
  }

  return {
    nextContainers,
    appliedValues: [...mergeResult.appliedValues],
  }
}

function createContainerValidationTracker(): ContainerValidationTracker {
  const ticketsByContainerId = new Map<string, number>()

  return {
    start(containerId: string): number {
      const ticket = (ticketsByContainerId.get(containerId) ?? 0) + 1
      ticketsByContainerId.set(containerId, ticket)
      return ticket
    },
    isCurrent(containerId: string, ticket: number): boolean {
      return ticketsByContainerId.get(containerId) === ticket
    },
    clear(containerId: string): void {
      ticketsByContainerId.delete(containerId)
    },
    reset(): void {
      ticketsByContainerId.clear()
    },
  }
}

function createDialogState(): DialogState {
  const [reference, setReference] = createSignal('')
  const [origin, setOrigin] = createSignal('')
  const [destination, setDestination] = createSignal('')
  const [containers, setContainers] = createStore<ContainerInput[]>([createEmptyContainer()])
  const [carrier, setCarrier] = createSignal<Carrier | ''>('')
  const [billOfLading, setBillOfLading] = createSignal('')
  const [bookingNumber, setBookingNumber] = createSignal('')
  const [importerName, setImporterName] = createSignal('')
  const [exporterName, setExporterName] = createSignal('')
  const [referenceImporter, setReferenceImporter] = createSignal('')
  const [product, setProduct] = createSignal('')
  const [redestinationNumber, setRedestinationNumber] = createSignal('')
  const [touched, setTouched] = createSignal<Record<string, boolean>>({})
  const [serverErrors, setServerErrors] = createSignal<Record<string, FieldError>>({})

  return {
    reference,
    setReference,
    origin,
    setOrigin,
    destination,
    setDestination,
    containers,
    setContainers,
    carrier,
    setCarrier,
    billOfLading,
    setBillOfLading,
    bookingNumber,
    setBookingNumber,
    importerName,
    setImporterName,
    exporterName,
    setExporterName,
    referenceImporter,
    setReferenceImporter,
    product,
    setProduct,
    redestinationNumber,
    setRedestinationNumber,
    touched,
    setTouched,
    serverErrors,
    setServerErrors,
  }
}

function asFormFieldSetters(state: DialogState): FormFieldSetters {
  return {
    setReference: state.setReference,
    setOrigin: state.setOrigin,
    setDestination: state.setDestination,
    setContainers: state.setContainers,
    setCarrier: state.setCarrier,
    setBillOfLading: state.setBillOfLading,
    setBookingNumber: state.setBookingNumber,
    setImporterName: state.setImporterName,
    setExporterName: state.setExporterName,
    setReferenceImporter: state.setReferenceImporter,
    setProduct: state.setProduct,
    setRedestinationNumber: state.setRedestinationNumber,
  }
}

function asDialogStateSetters(state: DialogState): DialogStateSetters {
  return {
    ...asFormFieldSetters(state),
    setTouched: state.setTouched,
    setServerErrors: state.setServerErrors,
  }
}

function createContainerFeedbackHandlers(params: CreateContainerFeedbackHandlersParams): {
  readonly getContainerError: (container: ContainerInput) => string | undefined
  readonly getDuplicateError: (container: ContainerInput) => string | undefined
  readonly getContainerLink: (container: ContainerInput) => string | undefined
  readonly openContainerLink: (container: ContainerInput) => void
} {
  const getContainerError = (container: ContainerInput): string | undefined => {
    const fieldKey = toContainerFieldKey(container.id)
    if (!params.touched()[fieldKey]) return undefined
    if (!container.containerNumber.trim()) {
      return params.containerRequiredMessage()
    }
    return params.serverErrors()[fieldKey]?.message
  }

  const getDuplicateError = (container: ContainerInput): string | undefined => {
    const normalized = params
      .containers()
      .map((entry) => normalizeContainerNumber(entry.containerNumber))
    const counts: Record<string, number> = {}
    for (const value of normalized) {
      if (!value) continue
      counts[value] = (counts[value] ?? 0) + 1
    }
    const current = normalizeContainerNumber(container.containerNumber)
    if (current && (counts[current] ?? 0) > 1) {
      return `${params.duplicateContainerMessage()} (${current})`
    }
    return undefined
  }

  const getContainerLink = (container: ContainerInput): string | undefined =>
    params.serverErrors()[toContainerFieldKey(container.id)]?.link

  const openContainerLink = (container: ContainerInput) => {
    const linkUrl = params.serverErrors()[toContainerFieldKey(container.id)]?.link
    if (!linkUrl) return

    const shouldNavigate = globalThis.confirm(params.confirmLoseProgressMessage())
    if (shouldNavigate) {
      params.navigateToAppLink(linkUrl)
    }
  }

  return { getContainerError, getDuplicateError, getContainerLink, openContainerLink }
}

function createContainerBlurHandler(
  params: CreateContainerBlurHandlerParams,
): (container: ContainerInput) => void {
  return (container) => {
    params.markTouched(toContainerFieldKey(container.id))
    clearContainerServerError(params.setServerErrors, container.id)

    const rawValue = container.containerNumber.trim()
    if (!rawValue) {
      params.validationTracker.clear(container.id)
      return
    }

    const normalized = normalizeContainerNumber(rawValue)
    if (params.initialContainerNumbers().has(normalized)) {
      params.validationTracker.clear(container.id)
      return
    }

    void (async () => {
      const ticket = params.validationTracker.start(container.id)

      try {
        const result = await requestContainerConflicts([normalized])
        if (!params.validationTracker.isCurrent(container.id, ticket)) return

        const currentContainer = findContainerById(params.getContainers(), container.id)
        if (!currentContainer) return

        const currentNormalized = normalizeContainerNumber(currentContainer.containerNumber)
        if (currentNormalized !== normalized) return

        if (!result.ok) {
          params.setServerErrors((previous) => ({
            ...previous,
            [toContainerFieldKey(container.id)]: { message: result.message },
          }))
          return
        }

        if (result.conflicts.length > 0) {
          const conflict = result.conflicts[0]
          if (!conflict) return
          const link = conflict.link
          params.setServerErrors((previous) => ({
            ...previous,
            [toContainerFieldKey(container.id)]: {
              message: conflict.message ?? `Container ${conflict.containerNumber} already exists`,
              ...(link === undefined ? {} : { link }),
            },
          }))
        }
      } catch (err) {
        if (!params.validationTracker.isCurrent(container.id, ticket)) return

        const currentContainer = findContainerById(params.getContainers(), container.id)
        if (!currentContainer) return
        const currentNormalized = normalizeContainerNumber(currentContainer.containerNumber)
        if (currentNormalized !== normalized) return

        console.error('onBlur check failed', err)
        params.setServerErrors((previous) => ({
          ...previous,
          [toContainerFieldKey(container.id)]: { message: DEFAULT_SERVER_ERROR },
        }))
      }
    })()
  }
}

function createContainerPasteHandler(
  params: CreateContainerPasteHandlerParams,
): (container: ContainerInput, event: ClipboardEvent) => void {
  return (container, event) => {
    const pastedText = event.clipboardData?.getData('text') ?? ''
    const parsed = parseContainerBulkPaste(pastedText)

    if (parsed.type === 'limit-exceeded') {
      event.preventDefault()
      params.validationTracker.clear(container.id)
      params.markTouched(toContainerFieldKey(container.id))
      params.setServerErrors((previous) => ({
        ...previous,
        [toContainerFieldKey(container.id)]: { message: params.pasteLimitMessage() },
      }))
      return
    }

    if (parsed.type === 'single') {
      event.preventDefault()
      params.validationTracker.clear(container.id)
      clearContainerServerError(params.setServerErrors, container.id)

      const current = params.getContainers()
      const index = current.findIndex((c) => c.id === container.id)
      if (index >= 0) {
        // apply normalized/sanitized single value into the target container
        params.setContainers(index, 'containerNumber', parsed.value)
      }

      return
    }

    if (parsed.type !== 'multiple') return

    event.preventDefault()

    const { nextContainers, appliedValues } = applyBulkPasteToContainers({
      containers: params.getContainers(),
      targetContainerId: container.id,
      pastedValues: parsed.values,
    })
    if (appliedValues.length === 0) return

    params.validationTracker.clear(container.id)
    clearContainerServerError(params.setServerErrors, container.id)
    params.setContainers(nextContainers)
  }
}

function createSubmitHandler(params: CreateSubmitHandlerParams): (event: Event) => void {
  return (event) => {
    event.preventDefault()

    const currentContainers = cloneContainers(params.getContainers())
    markContainersAsTouched(currentContainers, params.markTouched)

    if (!hasValidContainers(currentContainers)) return
    if (params.duplicateList().length > 0) return

    const carrierValue = params.getCarrier()

    void (async () => {
      params.setServerErrors({})

      try {
        const result = await validateSubmitWithServerCheck({
          containers: currentContainers,
          initialContainerNumbers: params.initialContainerNumbers(),
          carrier: carrierValue,
          buildData: params.buildData,
        })

        if (result.type === 'ready') {
          params.onReady(result.data)
          return
        }

        if (result.type === 'blocked') {
          markContainersAsTouched(currentContainers, params.markTouched)
          params.setServerErrors(result.errors)
        }
      } catch (err) {
        console.error('Failed to check containers before submit:', err)
        markContainersAsTouched(currentContainers, params.markTouched)
        params.setServerErrors(buildGenericErrors(currentContainers, DEFAULT_SERVER_ERROR))
      }
    })()
  }
}

function buildDialogForm(params: BuildDialogFormParams) {
  return {
    reference: params.reference,
    onReferenceInput: params.onReferenceInput,
    importerName: params.importerName,
    onImporterNameInput: params.onImporterNameInput,
    exporterName: params.exporterName,
    onExporterNameInput: params.onExporterNameInput,
    referenceImporter: params.referenceImporter,
    onReferenceImporterInput: params.onReferenceImporterInput,
    product: params.product,
    onProductInput: params.onProductInput,
    redestinationNumber: params.redestinationNumber,
    onRedestinationNumberInput: params.onRedestinationNumberInput,
    origin: params.origin,
    onOriginInput: params.onOriginInput,
    destination: params.destination,
    onDestinationInput: params.onDestinationInput,
    containerSection: {
      containers: params.containers,
      onUpdateContainer: params.onUpdateContainer,
      onContainerPaste: params.onContainerPaste,
      onContainerBlur: params.onContainerBlur,
      onRemoveContainer: params.onRemoveContainer,
      onAddContainer: params.onAddContainer,
      getContainerError: params.getContainerError,
      getDuplicateError: params.getDuplicateError,
      getContainerLink: params.getContainerLink,
      onOpenContainerLink: params.onOpenContainerLink,
    },
    sourceSection: {
      carrier: params.carrier,
      onCarrierInput: params.onCarrierInput,
      carrierOptions: params.carrierOptions,
      billOfLading: params.billOfLading,
      onBillOfLadingInput: params.onBillOfLadingInput,
      bookingNumber: params.bookingNumber,
      onBookingNumberInput: params.onBookingNumberInput,
    },
  }
}

function buildSubmitDataFromState(
  state: DialogState,
  validatedCarrier: Carrier,
): CreateProcessDialogFormData {
  return buildFormData({
    reference: state.reference(),
    origin: state.origin(),
    destination: state.destination(),
    containers: state.containers,
    carrier: validatedCarrier,
    billOfLading: state.billOfLading(),
    bookingNumber: state.bookingNumber(),
    importerName: state.importerName(),
    exporterName: state.exporterName(),
    referenceImporter: state.referenceImporter(),
    product: state.product(),
    redestinationNumber: state.redestinationNumber(),
  })
}

function toCloseGuardContainerNumbers(containers: readonly ContainerInput[]): readonly string[] {
  if (containers.length === 0) {
    return ['']
  }

  return containers.map((container) => container.containerNumber)
}

function toCloseGuardFormSnapshotFromState(
  state: DialogState,
): CreateProcessCloseGuardFormSnapshot {
  return {
    reference: state.reference(),
    origin: state.origin(),
    destination: state.destination(),
    containers: toCloseGuardContainerNumbers(state.containers),
    carrier: state.carrier(),
    billOfLading: state.billOfLading(),
    bookingNumber: state.bookingNumber(),
    importerName: state.importerName(),
    exporterName: state.exporterName(),
    referenceImporter: state.referenceImporter(),
    product: state.product(),
    redestinationNumber: state.redestinationNumber(),
  }
}

function toCloseGuardFormSnapshotFromInitialData(
  initialData: CreateProcessDialogFormData | null | undefined,
): CreateProcessCloseGuardFormSnapshot {
  if (!initialData) {
    return createDefaultCreateProcessCloseGuardFormSnapshot()
  }

  return {
    reference: initialData.reference || '',
    origin: initialData.origin || '',
    destination: initialData.destination || '',
    containers:
      initialData.containers.length > 0
        ? initialData.containers.map((container) => container.containerNumber)
        : [''],
    carrier: initialData.carrier || '',
    billOfLading: initialData.billOfLading || '',
    bookingNumber: initialData.bookingNumber || '',
    importerName: initialData.importerName || '',
    exporterName: initialData.exporterName || '',
    referenceImporter: initialData.referenceImporter || '',
    product: initialData.product || '',
    redestinationNumber: initialData.redestinationNumber || '',
  }
}

function toSmartPasteFormSnapshot(state: DialogState): SmartPasteFormSnapshot {
  return {
    reference: state.reference(),
    importerName: state.importerName(),
    exporterName: state.exporterName(),
    product: state.product(),
    referenceImporter: state.referenceImporter(),
    redestinationNumber: state.redestinationNumber(),
    origin: state.origin(),
    destination: state.destination(),
    billOfLading: state.billOfLading(),
    bookingNumber: state.bookingNumber(),
    containers: state.containers.map((container) => container.containerNumber),
  }
}

function toContainerInputs(
  currentContainers: readonly ContainerInput[],
  nextContainerNumbers: readonly string[],
): ContainerInput[] {
  if (nextContainerNumbers.length === 0) {
    return [createEmptyContainer()]
  }

  return nextContainerNumbers.map((containerNumber, index) => ({
    id: currentContainers[index]?.id ?? generateId(),
    containerNumber,
  }))
}

function applySmartPasteSnapshotToState(params: {
  readonly next: SmartPasteFormSnapshot
  readonly state: DialogState
}): void {
  params.state.setReference(params.next.reference)
  params.state.setImporterName(params.next.importerName)
  params.state.setExporterName(params.next.exporterName)
  params.state.setProduct(params.next.product)
  params.state.setReferenceImporter(params.next.referenceImporter)
  params.state.setRedestinationNumber(params.next.redestinationNumber)
  params.state.setOrigin(params.next.origin)
  params.state.setDestination(params.next.destination)
  params.state.setBillOfLading(params.next.billOfLading)
  params.state.setBookingNumber(params.next.bookingNumber)
  params.state.setContainers(toContainerInputs(params.state.containers, params.next.containers))
  params.state.setTouched({})
  params.state.setServerErrors({})
}

function toSmartPasteFieldLabel(
  field: SmartPasteScalarField,
  labels: Record<SmartPasteScalarField, string>,
): string {
  return labels[field]
}

function toSmartPasteDetectedFields(params: {
  readonly parsed: ParsedProcessDraft | null
  readonly labels: Record<SmartPasteScalarField, string>
}): readonly SmartPasteDetectedField[] {
  const parsed = params.parsed
  if (!parsed) return []

  const fields = parsed.fields
  const detected: SmartPasteDetectedField[] = []

  const maybePush = (field: SmartPasteScalarField, value: string | undefined) => {
    if (!value || value.trim().length === 0) return
    detected.push({
      label: toSmartPasteFieldLabel(field, params.labels),
      value,
    })
  }

  maybePush('reference', fields.reference)
  maybePush('importerName', fields.importerName)
  maybePush('exporterName', fields.exporterName)
  maybePush('product', fields.product)
  maybePush('origin', fields.origin)
  maybePush('billOfLading', fields.billOfLading)
  maybePush('redestinationNumber', fields.redestinationNumber)
  maybePush('referenceImporter', fields.referenceImporter)
  maybePush('destination', fields.destination)
  maybePush('bookingNumber', fields.bookingNumber)

  return detected
}

function toSmartPasteWarningMessages(params: {
  readonly parsed: ParsedProcessDraft | null
  readonly carrierNotDetected: string
  readonly noContainerFound: string
}): readonly string[] {
  const warnings = params.parsed?.warnings ?? []
  const messages: string[] = []

  for (const warning of warnings) {
    if (warning === 'carrier_not_detected') {
      messages.push(params.carrierNotDetected)
      continue
    }
    if (warning === 'no_valid_container_found') {
      messages.push(params.noContainerFound)
    }
  }

  return messages
}

function toSmartPasteConflictViews(params: {
  readonly conflicts: readonly SmartPasteFieldConflict[]
  readonly labels: Record<SmartPasteScalarField, string>
}): readonly SmartPasteConflictView[] {
  return params.conflicts.map((conflict) => ({
    fieldLabel: toSmartPasteFieldLabel(conflict.field, params.labels),
    currentValue: conflict.currentValue,
    importedValue: conflict.importedValue,
  }))
}

function createDialogFormMemo(
  params: CreateDialogFormMemoParams,
): Accessor<ReturnType<typeof buildDialogForm>> {
  const form = createMemo(() =>
    buildDialogForm({
      reference: params.state.reference(),
      onReferenceInput: params.state.setReference,
      importerName: params.state.importerName(),
      onImporterNameInput: params.state.setImporterName,
      exporterName: params.state.exporterName(),
      onExporterNameInput: params.state.setExporterName,
      referenceImporter: params.state.referenceImporter(),
      onReferenceImporterInput: params.state.setReferenceImporter,
      product: params.state.product(),
      onProductInput: params.state.setProduct,
      redestinationNumber: params.state.redestinationNumber(),
      onRedestinationNumberInput: params.state.setRedestinationNumber,
      origin: params.state.origin(),
      onOriginInput: params.state.setOrigin,
      destination: params.state.destination(),
      onDestinationInput: params.state.setDestination,
      containers: params.state.containers,
      onUpdateContainer: params.onUpdateContainer,
      onContainerPaste: params.onContainerPaste,
      onContainerBlur: params.onContainerBlur,
      onRemoveContainer: params.onRemoveContainer,
      onAddContainer: params.onAddContainer,
      getContainerError: params.getContainerError,
      getDuplicateError: params.getDuplicateError,
      getContainerLink: params.getContainerLink,
      onOpenContainerLink: params.onOpenContainerLink,
      carrier: params.state.carrier(),
      onCarrierInput: params.onCarrierInput,
      carrierOptions: params.carrierOptions(),
      billOfLading: params.state.billOfLading(),
      onBillOfLadingInput: params.state.setBillOfLading,
      bookingNumber: params.state.bookingNumber(),
      onBookingNumberInput: params.state.setBookingNumber,
    }),
  )
  return form
}

function createSmartPasteController(
  params: CreateSmartPasteControllerParams,
): SmartPasteController {
  const [smartPasteOpen, setSmartPasteOpen] = createSignal(false)
  const [smartPasteRawText, setSmartPasteRawText] = createSignal('')
  const [smartPasteParsed, setSmartPasteParsed] = createSignal<ParsedProcessDraft | null>(null)
  const [smartPastePendingPlan, setSmartPastePendingPlan] =
    createSignal<SmartPasteApplyPlan | null>(null)
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = createSignal(false)
  const [smartPasteApplyErrorMessage, setSmartPasteApplyErrorMessage] = createSignal('')

  const smartPasteEnabled = createMemo(() => params.mode() !== 'edit')
  const smartPasteDialogOpen = createMemo(() => params.open() && smartPasteOpen())
  const hasUnsavedDraft = createMemo(() =>
    isSmartPasteCloseGuardDirty({
      rawText: smartPasteRawText(),
      hasParsed: smartPasteParsed() !== null,
    }),
  )
  const smartPasteFieldLabels = createMemo<Record<SmartPasteScalarField, string>>(() => ({
    reference: params.t(params.keys.createProcess.field.reference),
    importerName: params.t(params.keys.createProcess.field.importerName),
    exporterName: params.t(params.keys.createProcess.field.exporterName),
    product: params.t(params.keys.createProcess.field.product),
    referenceImporter: params.t(params.keys.createProcess.field.referenceImporter),
    redestinationNumber: params.t(params.keys.createProcess.field.redestinationNumber),
    origin: params.t(params.keys.createProcess.field.origin),
    destination: params.t(params.keys.createProcess.field.destination),
    billOfLading: params.t(params.keys.createProcess.field.billOfLading),
    bookingNumber: params.t(params.keys.createProcess.field.bookingNumber),
  }))

  const forceClose = () => {
    setSmartPasteOpen(false)
    setSmartPasteRawText('')
    setSmartPasteParsed(null)
    setSmartPastePendingPlan(null)
    setOverwriteConfirmOpen(false)
    setSmartPasteApplyErrorMessage('')
  }

  const reset = () => {
    forceClose()
  }

  const applySmartPasteResult = (plan: SmartPasteApplyPlan, overwriteConflicts: boolean) => {
    const current = toSmartPasteFormSnapshot(params.state)
    const next = applySmartPasteApplyPlan({
      current,
      plan,
      overwriteConflicts,
    })
    applySmartPasteSnapshotToState({
      next,
      state: params.state,
    })
  }

  const handleOpen = () => {
    if (!params.open()) return
    if (!smartPasteEnabled()) return
    setSmartPasteOpen(true)
    setSmartPasteApplyErrorMessage('')
  }

  const handleCloseRequest = () => {
    if (!smartPasteDialogOpen()) return
    params.onCloseRequest()
  }

  const handleAnalyze = () => {
    const parsed = parseTrelloSmartPaste(smartPasteRawText())
    setSmartPasteParsed(parsed)
    setSmartPastePendingPlan(null)
    setOverwriteConfirmOpen(false)
    setSmartPasteApplyErrorMessage('')
  }

  const handleApply = () => {
    const parsed = smartPasteParsed()
    if (!parsed) return

    if (parsed.fields.containers.length === 0) {
      setSmartPasteApplyErrorMessage(
        params.t(params.keys.createProcess.smartPaste.error.noContainers),
      )
      return
    }

    const plan = buildSmartPasteApplyPlan({
      current: toSmartPasteFormSnapshot(params.state),
      draft: parsed,
    })

    if (plan.conflicts.length > 0) {
      setSmartPastePendingPlan(plan)
      setOverwriteConfirmOpen(true)
      // Hide the Smart Paste dialog while showing the overwrite confirmation
      setSmartPasteOpen(false)
      setSmartPasteApplyErrorMessage('')
      return
    }

    applySmartPasteResult(plan, false)
    forceClose()
  }

  const handleConfirmOverwrite = () => {
    const pendingPlan = smartPastePendingPlan()
    if (!pendingPlan) return

    applySmartPasteResult(pendingPlan, true)
    forceClose()
  }

  const handleCancelOverwrite = () => {
    setOverwriteConfirmOpen(false)
    // Re-open the Smart Paste dialog so the user can continue editing
    setSmartPasteOpen(true)
  }

  const smartPasteDetectedFields = createMemo(() =>
    toSmartPasteDetectedFields({
      parsed: smartPasteParsed(),
      labels: smartPasteFieldLabels(),
    }),
  )
  const smartPasteWarnings = createMemo(() =>
    toSmartPasteWarningMessages({
      parsed: smartPasteParsed(),
      carrierNotDetected: params.t(params.keys.createProcess.smartPaste.warning.carrierNotDetected),
      noContainerFound: params.t(
        params.keys.createProcess.smartPaste.warning.noValidContainerFound,
      ),
    }),
  )
  const smartPasteConflicts = createMemo(() =>
    toSmartPasteConflictViews({
      conflicts: smartPastePendingPlan()?.conflicts ?? [],
      labels: smartPasteFieldLabels(),
    }),
  )

  const smartPaste = createMemo<SmartPasteViewModel>(() => ({
    enabled: smartPasteEnabled(),
    open: smartPasteDialogOpen(),
    rawText: smartPasteRawText(),
    hasParsed: smartPasteParsed() !== null,
    hasContainersDetected: (smartPasteParsed()?.fields.containers.length ?? 0) > 0,
    detectedFields: smartPasteDetectedFields(),
    detectedContainers: smartPasteParsed()?.fields.containers ?? [],
    unmappedFields: smartPasteParsed()?.unmappedFields ?? [],
    warnings: smartPasteWarnings(),
    conflicts: smartPasteConflicts(),
    applyErrorMessage: smartPasteApplyErrorMessage(),
    onOpen: handleOpen,
    onClose: handleCloseRequest,
    onTextInput: (value) => setSmartPasteRawText(value),
    onAnalyze: handleAnalyze,
    onApply: handleApply,
    onCancelOverwrite: handleCancelOverwrite,
    onConfirmOverwrite: handleConfirmOverwrite,
  }))

  return {
    smartPaste,
    overwriteConfirmOpen,
    open: smartPasteDialogOpen,
    hasUnsavedDraft,
    forceClose,
    reset,
  }
}

function createCloseGuardController(
  params: CreateCloseGuardControllerParams,
): CloseGuardController {
  const [closeGuardTarget, setCloseGuardTarget] = createSignal<CloseGuardTarget | null>(null)

  createEffect(() => {
    if (!params.open()) {
      setCloseGuardTarget(null)
    }
  })

  const formCloseBaseline = createMemo<CreateProcessCloseGuardFormSnapshot>(() => {
    if (params.mode() === 'edit') {
      return toCloseGuardFormSnapshotFromInitialData(params.initialData())
    }

    return createDefaultCreateProcessCloseGuardFormSnapshot()
  })
  const isFormDirty = createMemo(() =>
    isCreateProcessCloseGuardFormDirty({
      baseline: formCloseBaseline(),
      current: toCloseGuardFormSnapshotFromState(params.state),
    }),
  )

  const closeDialogForce = () => {
    params.onForceClose()
    setCloseGuardTarget(null)
  }

  const cancelCloseGuard = () => {
    setCloseGuardTarget(null)
  }

  const requestSmartPasteClose = () => {
    if (closeGuardTarget() !== null) return
    if (params.smartPasteController.overwriteConfirmOpen()) return
    if (!params.smartPasteController.open()) return

    if (!params.smartPasteController.hasUnsavedDraft()) {
      params.smartPasteController.forceClose()
      return
    }

    setCloseGuardTarget('smartPaste')
  }

  const requestDialogClose = () => {
    if (closeGuardTarget() !== null) return

    if (params.smartPasteController.open()) {
      requestSmartPasteClose()
      return
    }

    if (!isFormDirty()) {
      closeDialogForce()
      return
    }

    setCloseGuardTarget('form')
  }

  const confirmCloseGuard = () => {
    const target = closeGuardTarget()
    if (!target) return

    if (target === 'smartPaste') {
      params.smartPasteController.forceClose()
      setCloseGuardTarget(null)
      return
    }

    closeDialogForce()
  }

  const closeGuard = createMemo<CloseGuardViewModel>(() => ({
    open: params.open() && closeGuardTarget() !== null,
    target: closeGuardTarget(),
  }))

  return {
    closeGuard,
    requestDialogClose,
    requestSmartPasteClose,
    cancelCloseGuard,
    confirmCloseGuard,
    closeDialogForce,
  }
}

export function CreateProcessDialog(props: Props): JSX.Element {
  const navigate = useNavigate()
  const { t, keys } = useTranslation()
  const state = createDialogState()
  const formFieldSetters = asFormFieldSetters(state)
  const containerValidationTracker = createContainerValidationTracker()

  const initialContainerNumbersSet = createMemo(
    () =>
      new Set<string>(
        (props.initialData?.containers ?? []).map((container) =>
          normalizeContainerNumber(container.containerNumber),
        ),
      ),
  )

  createEffect(() => {
    populateFormFromInitialData({
      open: props.open,
      focus: props.focus,
      setters: formFieldSetters,
      ...(props.initialData === undefined ? {} : { initialData: props.initialData }),
    })
  })

  const mode = createMemo(() => props.mode ?? 'create')
  const carrierOptions = createMemo(() =>
    buildProcessCarrierOptions(t(keys.createProcess.carrierUnknown)),
  )
  let requestSmartPasteClose = () => {}

  const smartPasteController = createSmartPasteController({
    open: () => props.open,
    mode,
    state,
    t,
    keys,
    onCloseRequest: () => requestSmartPasteClose(),
  })
  const closeGuardController = createCloseGuardController({
    open: () => props.open,
    mode,
    initialData: () => props.initialData,
    state,
    smartPasteController,
    onForceClose: () => {
      containerValidationTracker.reset()
      resetDialogState(asDialogStateSetters(state))
      smartPasteController.reset()
      props.onClose()
    },
  })
  requestSmartPasteClose = closeGuardController.requestSmartPasteClose

  const markTouched = (fieldKey: string) => {
    state.setTouched((previous) => ({ ...previous, [fieldKey]: true }))
  }

  createEffect(() => {
    const containerIds = state.containers.map((container) => container.id)
    state.setServerErrors((previous) => retainContainerScopedFields(previous, containerIds))
    state.setTouched((previous) => retainContainerScopedFields(previous, containerIds))
  })

  const updateContainer = (id: string, value: string) => {
    clearContainerServerError(state.setServerErrors, id)
    containerValidationTracker.clear(id)

    const index = state.containers.findIndex((container) => container.id === id)
    if (index >= 0) {
      state.setContainers(index, 'containerNumber', value)
    }
  }

  const addContainer = () => {
    state.setContainers([...state.containers, createEmptyContainer()])
  }

  const removeContainer = (id: string) => {
    if (state.containers.length <= 1) return

    clearContainerServerError(state.setServerErrors, id)
    clearContainerTouched(state.setTouched, id)
    containerValidationTracker.clear(id)

    state.setContainers(state.containers.filter((container) => container.id !== id))
  }

  const containerFeedbackHandlers = createContainerFeedbackHandlers({
    containers: () => state.containers,
    touched: state.touched,
    serverErrors: state.serverErrors,
    containerRequiredMessage: () => t(keys.createProcess.validation.containerNumberRequired),
    duplicateContainerMessage: () => t(keys.createProcess.validation.duplicateContainer),
    confirmLoseProgressMessage: () => t(keys.createProcess.action.confirmLoseProgress),
    navigateToAppLink: (href) => {
      navigateToAppHref({
        navigate,
        href,
      })
    },
  })

  const onContainerBlur = createContainerBlurHandler({
    markTouched,
    getContainers: () => state.containers,
    initialContainerNumbers: initialContainerNumbersSet,
    setServerErrors: state.setServerErrors,
    validationTracker: containerValidationTracker,
  })

  const onContainerPaste = createContainerPasteHandler({
    getContainers: () => state.containers,
    setContainers: state.setContainers,
    markTouched,
    setServerErrors: state.setServerErrors,
    validationTracker: containerValidationTracker,
    pasteLimitMessage: () =>
      t(keys.createProcess.validation.pasteLimitExceeded, {
        max: MAX_CONTAINERS_PER_PASTE,
      }),
  })

  const duplicateList = createMemo(() =>
    findDuplicateStrings(buildContainerNumbers(state.containers)),
  )
  const visibleServerErrorEntries = createMemo(() =>
    listVisibleContainerServerErrors(state.serverErrors(), state.containers),
  )

  const isSubmitDisabled = createMemo(() => {
    if (!hasValidContainers(state.containers)) return true
    if ((duplicateList() ?? []).length > 0) return true
    if (state.carrier() === '') return true
    if (visibleServerErrorEntries().length > 0) return true
    return false
  })

  const submitTooltip = createMemo(() => {
    if (!isSubmitDisabled()) return ''

    const duplicates = duplicateList()
    if (duplicates.length > 0) {
      return `${t(keys.createProcess.validation.duplicateContainer)} (${duplicates[0]})`
    }

    const blockingError = visibleServerErrorEntries()[0]
    if (blockingError) {
      return blockingError[1].message
    }

    if (state.carrier() === '') return t(keys.createProcess.field.carrierPlaceholder)
    if (!hasValidContainers(state.containers)) {
      return t(keys.createProcess.validation.containerNumberRequired)
    }
    return ''
  })

  const buildData = (validatedCarrier: Carrier): CreateProcessDialogFormData =>
    buildSubmitDataFromState(state, validatedCarrier)

  const handleSubmit = createSubmitHandler({
    getContainers: () => state.containers,
    markTouched,
    duplicateList,
    getCarrier: state.carrier,
    buildData,
    initialContainerNumbers: initialContainerNumbersSet,
    setServerErrors: state.setServerErrors,
    onReady: (data) => {
      props.onSubmit?.(data)
      closeGuardController.closeDialogForce()
    },
  })

  const handleCarrierInput = (value: string) => {
    if (value === '' || isProcessDialogCarrier(value)) {
      state.setCarrier(value)
    }
  }

  const form = createDialogFormMemo({
    state,
    carrierOptions,
    onUpdateContainer: updateContainer,
    onContainerPaste,
    onContainerBlur,
    onRemoveContainer: removeContainer,
    onAddContainer: addContainer,
    getContainerError: containerFeedbackHandlers.getContainerError,
    getDuplicateError: containerFeedbackHandlers.getDuplicateError,
    getContainerLink: containerFeedbackHandlers.getContainerLink,
    onOpenContainerLink: containerFeedbackHandlers.openContainerLink,
    onCarrierInput: handleCarrierInput,
  })

  return (
    <CreateProcessDialogView
      open={props.open}
      mode={mode()}
      onClose={closeGuardController.requestDialogClose}
      onSubmit={handleSubmit}
      form={form()}
      submitDisabled={isSubmitDisabled()}
      submitTooltip={submitTooltip()}
      smartPaste={smartPasteController.smartPaste()}
      overwriteConfirmOpen={props.open && smartPasteController.overwriteConfirmOpen()}
      closeGuard={{
        ...closeGuardController.closeGuard(),
        onCancel: closeGuardController.cancelCloseGuard,
        onConfirm: closeGuardController.confirmCloseGuard,
      }}
    />
  )
}
