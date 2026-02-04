import type { JSX } from 'solid-js'
import { createEffect, createSignal, For } from 'solid-js'
import { createStore } from 'solid-js/store'
import { useTranslation } from '~/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { FormInput, FormSelect } from '~/shared/ui/FormFields'

const keys = {
  title: 'createProcess.title',
  titleEdit: 'createProcess.titleEdit',
  description: 'createProcess.description',
  // Section: Identification
  sectionIdentification: 'createProcess.section.identification',
  reference: 'createProcess.field.reference',
  referencePlaceholder: 'createProcess.field.referencePlaceholder',
  operationType: 'createProcess.field.operationType',
  operationTypePlaceholder: 'createProcess.field.operationTypePlaceholder',
  opImport: 'createProcess.operationType.import',
  opExport: 'createProcess.operationType.export',
  opTransshipment: 'createProcess.operationType.transshipment',
  opUnknown: 'createProcess.operationType.unknown',
  // Section: Route
  sectionRoute: 'createProcess.section.route',
  routeHelper: 'createProcess.section.routeHelper',
  origin: 'createProcess.field.origin',
  originPlaceholder: 'createProcess.field.originPlaceholder',
  destination: 'createProcess.field.destination',
  destinationPlaceholder: 'createProcess.field.destinationPlaceholder',
  // Section: Containers
  sectionContainers: 'createProcess.section.containers',
  containerNumber: 'createProcess.field.containerNumber',
  containerNumberPlaceholder: 'createProcess.field.containerNumberPlaceholder',
  containerNumberRequired: 'createProcess.validation.containerNumberRequired',
  isoType: 'createProcess.field.isoType',
  isoTypePlaceholder: 'createProcess.field.isoTypePlaceholder',
  addContainer: 'createProcess.action.addContainer',
  removeContainer: 'createProcess.action.removeContainer',
  // Section: Source
  sectionSource: 'createProcess.section.source',
  carrier: 'createProcess.field.carrier',
  carrierPlaceholder: 'createProcess.field.carrierPlaceholder',
  blReference: 'createProcess.field.blReference',
  blReferencePlaceholder: 'createProcess.field.blReferencePlaceholder',
  // Actions
  create: 'createProcess.action.create',
  update: 'createProcess.action.update',
  cancel: 'createProcess.action.cancel',
}

export type ContainerInput = {
  readonly id: string
  containerNumber: string
  isoType: string
}

export type FormData = {
  reference: string
  operationType: string
  origin: string
  destination: string
  containers: ContainerInput[]
  carrier: string
  blReference: string
}

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit?: (data: FormData) => void
  readonly initialData?: FormData | null
  readonly mode?: 'create' | 'edit'
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function createEmptyContainer(): ContainerInput {
  return { id: generateId(), containerNumber: '', isoType: '' }
}

export function CreateProcessDialog(props: Props): JSX.Element {
  const { t } = useTranslation()

  // Form state
  const [reference, setReference] = createSignal('')
  const [operationType, setOperationType] = createSignal('')
  const [origin, setOrigin] = createSignal('')
  const [destination, setDestination] = createSignal('')
  const [containers, setContainers] = createStore<ContainerInput[]>([createEmptyContainer()])
  const [carrier, setCarrier] = createSignal('')
  const [blReference, setBlReference] = createSignal('')
  const [touched, setTouched] = createSignal<Record<string, boolean>>({})

  // Populate form when editing
  createEffect(() => {
    if (props.open && props.initialData) {
      setReference(props.initialData.reference || '')
      setOperationType(props.initialData.operationType || '')
      setOrigin(props.initialData.origin || '')
      setDestination(props.initialData.destination || '')
      setCarrier(props.initialData.carrier || '')
      setBlReference(props.initialData.blReference || '')
      setContainers(
        props.initialData.containers.length
          ? props.initialData.containers.map((c) => ({
              id: c.id,
              containerNumber: c.containerNumber,
              isoType: c.isoType,
            }))
          : [createEmptyContainer()],
      )
    }
  })

  const operationOptions = () => [
    { value: 'import', label: t(keys.opImport) },
    { value: 'export', label: t(keys.opExport) },
    { value: 'transshipment', label: t(keys.opTransshipment) },
    { value: 'unknown', label: t(keys.opUnknown) },
  ]

  const carrierOptions = () => [
    { value: 'maersk', label: 'Maersk' },
    { value: 'msc', label: 'MSC' },
    { value: 'cmacgm', label: 'CMA CGM' },
    { value: 'unknown', label: t(keys.opUnknown) },
  ]

  const updateContainer = (id: string, field: 'containerNumber' | 'isoType', value: string) => {
    const idx = containers.findIndex((c) => c.id === id)
    if (idx >= 0) {
      // update the specific field in the store to avoid remounting the whole item
      setContainers(idx, field, value)
    }
  }

  const addContainer = () => {
    setContainers([...containers, createEmptyContainer()])
  }

  const removeContainer = (id: string) => {
    if (containers.length <= 1) return
    setContainers(containers.filter((c) => c.id !== id))
  }

  const getContainerError = (container: ContainerInput): string | undefined => {
    const fieldKey = `container-${container.id}`
    if (!touched()[fieldKey]) return undefined
    if (!container.containerNumber.trim()) {
      return t(keys.containerNumberRequired)
    }
    return undefined
  }

  const markTouched = (fieldKey: string) => {
    setTouched((prev) => ({ ...prev, [fieldKey]: true }))
  }

  const hasValidContainers = () => {
    return containers.some((c) => c.containerNumber.trim().length > 0)
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()

    // Mark all container fields as touched
    for (const c of containers) {
      markTouched(`container-${c.id}`)
    }

    if (!hasValidContainers()) {
      return
    }

    const data: FormData = {
      reference: reference(),
      operationType: operationType(),
      origin: origin(),
      destination: destination(),
      containers: containers.filter((c) => c.containerNumber.trim()),
      carrier: carrier(),
      blReference: blReference(),
    }

    props.onSubmit?.(data)
    handleClose()
  }

  const handleClose = () => {
    // Reset form
    setReference('')
    setOperationType('')
    setOrigin('')
    setDestination('')
    setContainers([createEmptyContainer()])
    setCarrier('')
    setBlReference('')
    setTouched({})
    props.onClose()
  }

  return (
    <Dialog
      open={props.open}
      onClose={handleClose}
      title={t(props.mode === 'edit' ? keys.titleEdit : keys.title)}
      description={t(keys.description)}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} class="space-y-8">
        {/* Section: Identification */}
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.sectionIdentification)}
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormInput
              label={t(keys.reference)}
              name="reference"
              value={reference()}
              onInput={setReference}
              placeholder={t(keys.referencePlaceholder)}
            />
            <FormSelect
              label={t(keys.operationType)}
              name="operationType"
              value={operationType()}
              onInput={setOperationType}
              options={operationOptions()}
              placeholder={t(keys.operationTypePlaceholder)}
            />
          </div>
        </section>

        {/* Section: Planned Route */}
        <section>
          <h3 class="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.sectionRoute)}
          </h3>
          <p class="mb-4 text-xs text-slate-400">{t(keys.routeHelper)}</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormInput
              label={t(keys.origin)}
              name="origin"
              value={origin()}
              onInput={setOrigin}
              placeholder={t(keys.originPlaceholder)}
            />
            <FormInput
              label={t(keys.destination)}
              name="destination"
              value={destination()}
              onInput={setDestination}
              placeholder={t(keys.destinationPlaceholder)}
            />
          </div>
        </section>

        {/* Section: Containers */}
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.sectionContainers)}
          </h3>
          <div class="space-y-3">
            <For each={containers}>
              {(container, index) => (
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div class="grid flex-1 gap-4 sm:grid-cols-2">
                    <FormInput
                      label={`${t(keys.containerNumber)} ${index() + 1}`}
                      name={`container-${container.id}`}
                      value={container.containerNumber}
                      onInput={(v) => updateContainer(container.id, 'containerNumber', v)}
                      onBlur={() => markTouched(`container-${container.id}`)}
                      placeholder={t(keys.containerNumberPlaceholder)}
                      error={getContainerError(container)}
                      required
                    />
                    <FormInput
                      label={t(keys.isoType)}
                      name={`iso-${container.id}`}
                      value={container.isoType}
                      onInput={(v) => updateContainer(container.id, 'isoType', v)}
                      placeholder={t(keys.isoTypePlaceholder)}
                    />
                  </div>
                  {containers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContainer(container.id)}
                      class="mt-7 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                      aria-label={t(keys.removeContainer)}
                    >
                      <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </For>
          </div>
          <button
            type="button"
            onClick={addContainer}
            class="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t(keys.addContainer)}
          </button>
        </section>

        {/* Section: Source / Integration */}
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.sectionSource)}
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormSelect
              label={t(keys.carrier)}
              name="carrier"
              value={carrier()}
              onInput={setCarrier}
              options={carrierOptions()}
              placeholder={t(keys.carrierPlaceholder)}
            />
            <FormInput
              label={t(keys.blReference)}
              name="blReference"
              value={blReference()}
              onInput={setBlReference}
              placeholder={t(keys.blReferencePlaceholder)}
            />
          </div>
        </section>

        {/* Actions */}
        <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={handleClose}
            class="rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            {t(keys.cancel)}
          </button>
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            {t(props.mode === 'edit' ? keys.update : keys.create)}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
