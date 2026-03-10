import { useNavigate } from '@solidjs/router'
import type { Accessor, JSX, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import { CreateProcessDialogView } from '~/modules/process/ui/CreateProcessDialog.view'
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
import { useTranslation } from '~/shared/localization/i18n'
import { navigateToAppHref } from '~/shared/ui/navigation/app-navigation'
import { findDuplicateStrings } from '~/shared/utils/findDuplicateStrings'
import { isRecord } from '~/shared/utils/typeGuards'

type Carrier = 'maersk' | 'msc' | 'cmacgm' | 'hapag' | 'one' | 'evergreen' | 'unknown'

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

function isCarrier(value: string): value is Carrier {
  return ['maersk', 'msc', 'cmacgm', 'hapag', 'one', 'evergreen', 'unknown'].includes(value)
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
    errors[fieldKey] = {
      message: conflict.message ?? `Container ${conflict.containerNumber} already exists`,
      link: conflict.link,
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
      link: typeof item.link === 'string' ? item.link : undefined,
      message: typeof item.message === 'string' ? item.message : undefined,
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
  if (!isCarrier(params.carrier)) return { type: 'invalid-carrier' }

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

function buildCarrierOptions(
  unknownLabel: string,
): readonly { readonly value: Carrier; readonly label: string }[] {
  return [
    { value: 'maersk', label: 'Maersk' },
    { value: 'msc', label: 'MSC' },
    { value: 'cmacgm', label: 'CMA CGM' },
    { value: 'unknown', label: unknownLabel },
  ]
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
    if (current && counts[current] > 1) {
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
          params.setServerErrors((previous) => ({
            ...previous,
            [toContainerFieldKey(container.id)]: {
              message: conflict.message ?? `Container ${conflict.containerNumber} already exists`,
              link: conflict.link,
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
      initialData: props.initialData,
      focus: props.focus,
      setters: formFieldSetters,
    })
  })

  const carrierOptions = createMemo(() => buildCarrierOptions(t(keys.createProcess.carrierUnknown)))

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

  const handleClose = () => {
    containerValidationTracker.reset()
    resetDialogState(asDialogStateSetters(state))
    props.onClose()
  }

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
      handleClose()
    },
  })

  const handleCarrierInput = (value: string) => {
    if (value === '' || isCarrier(value)) {
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
      mode={props.mode}
      onClose={handleClose}
      onSubmit={handleSubmit}
      form={form()}
      submitDisabled={isSubmitDisabled()}
      submitTooltip={submitTooltip()}
    />
  )
}
