import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { useTranslation } from '~/i18n'
import { findDuplicateContainers } from '~/modules/process/domain/processStuff'
import type { Carrier, OperationType } from '~/modules/process/domain/value-objects'
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
  duplicateContainer: 'createProcess.validation.duplicateContainer',
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

export type CreateProcessDialogFormData = {
  reference: string
  operationType: OperationType
  origin: string
  destination: string
  containers: ContainerInput[]
  carrier: Carrier
  billOfLading: string
}

type Props = {
  readonly open: boolean
  readonly onClose: () => void
  readonly onSubmit?: (data: CreateProcessDialogFormData) => void
  readonly initialData?: CreateProcessDialogFormData | null
  readonly mode?: 'create' | 'edit'
  readonly focusReference?: boolean
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
  const [operationType, setOperationType] = createSignal<OperationType>('unknown')
  const [origin, setOrigin] = createSignal('')
  const [destination, setDestination] = createSignal('')
  const [containers, setContainers] = createStore<ContainerInput[]>([createEmptyContainer()])
  const [carrier, setCarrier] = createSignal<Carrier>('unknown')
  const [billOfLading, setBillOfLading] = createSignal('')
  const [touched, setTouched] = createSignal<Record<string, boolean>>({})
  const [serverErrors, setServerErrors] = createSignal<
    Record<string, { message: string; link?: string }>
  >({})

  // Set of container numbers that were present when the dialog was opened (edit initial state)
  const initialContainerNumbersSet = createMemo(
    () =>
      new Set<string>(
        (props.initialData?.containers ?? []).map((c) => c.containerNumber.toUpperCase().trim()),
      ),
  )

  // Populate form when editing
  createEffect(() => {
    if (props.open && props.initialData) {
      setReference(props.initialData.reference || '')
      setOperationType(props.initialData.operationType || '')
      setOrigin(props.initialData.origin || '')
      setDestination(props.initialData.destination || '')
      setCarrier(props.initialData.carrier || '')
      setBillOfLading(props.initialData.billOfLading || '')
      setContainers(
        props.initialData.containers.length
          ? props.initialData.containers.map((c) => ({
              id: c.id,
              containerNumber: c.containerNumber,
              isoType: c.isoType,
            }))
          : [createEmptyContainer()],
      )

      // Optionally autofocus the reference input when requested by the caller
      if (props.focusReference) {
        // schedule after next tick so input is mounted
        setTimeout(() => {
          try {
            const el = document.getElementById('reference')
            if (el instanceof HTMLInputElement) {
              el.focus()
              // select existing text for convenience
              try {
                el.select()
              } catch {
                /* ignore */
              }
            }
          } catch {
            /* ignore */
          }
        }, 0)
      }
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
    // Prefer server-side error if present for this container
    const srv = serverErrors()[fieldKey]
    if (srv) return srv.message
    return undefined
  }

  // Return duplicate error for a container if the same container number appears more than once in the form
  const getDuplicateError = (container: ContainerInput): string | undefined => {
    const normalized = containers.map((c) => c.containerNumber.toUpperCase().trim())
    const counts: Record<string, number> = {}
    for (const n of normalized) {
      if (!n) continue
      counts[n] = (counts[n] ?? 0) + 1
    }
    const thisNum = container.containerNumber.toUpperCase().trim()
    if (thisNum && counts[thisNum] > 1) {
      // include the number for clarity
      return `${t(keys.duplicateContainer)} (${thisNum})`
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

    // Check for duplicate container numbers in the form and block submission
    const containerNumbers = containers
      .map((c) => c.containerNumber.trim())
      .filter((n) => n.length > 0)
    const duplicates = findDuplicateContainers(containerNumbers)
    if (duplicates.length > 0) {
      // keep touched state so inline errors (duplicate) are visible and prevent submit
      return
    }

    // Fail-fast server-side check: ask backend if any of these container numbers already exist.
    // IMPORTANT: when editing, skip checking container numbers that were already present in
    // the initial process (they are allowed to remain). Only check new or changed numbers.
    const entries = containerNumbers.map((n, i) => ({
      num: n.toUpperCase().trim(),
      id: containers[i].id,
    }))
    const entriesToCheck = entries.filter((e) => !initialContainerNumbersSet().has(e.num))
    const containerNumbersForCheck = entriesToCheck.map((e) => e.num)
    ;(async () => {
      try {
        // Reset previous server errors
        setServerErrors({})

        // If nothing to check (e.g., editing without adding new containers), skip server check
        if (containerNumbersForCheck.length === 0) {
          // proceed with submit
          const data: CreateProcessDialogFormData = {
            reference: reference(),
            operationType: operationType(),
            origin: origin(),
            destination: destination(),
            containers: containers.filter((c) => c.containerNumber.trim()),
            carrier: carrier(),
            billOfLading: billOfLading(),
          }

          props.onSubmit?.(data)
          handleClose()
          return
        }

        const res = await fetch('/api/processes/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ containers: containerNumbersForCheck }),
        })

        if (!res.ok) {
          // Unexpected error from check endpoint - surface generic message
          const txt = await res.text().catch(() => '')
          setServerErrors(
            Object.fromEntries(
              containerNumbers.map((n, i) => [
                `container-${containers[i].id}`,
                { message: txt || 'Failed to validate container' },
              ]),
            ),
          )
          return
        }

        const json = await res.json().catch(() => ({}))
        const conflicts: {
          containerNumber: string
          processId?: string
          containerId?: string
          link?: string
          message?: string
        }[] = json.conflicts || []

        if (conflicts.length > 0) {
          // Map conflicts to per-field errors and mark touched so they show inline
          const errs: Record<string, { message: string; link?: string }> = {}
          for (const c of conflicts) {
            // find matching entry in the entriesToCheck array
            const match = entriesToCheck.find((e) => e.num === c.containerNumber.toUpperCase())
            const fieldKey = match ? `container-${match.id}` : `container-${c.containerNumber}`
            errs[fieldKey] = {
              message: c.message ?? `Container ${c.containerNumber} already exists`,
              link: c.link,
            }
          }
          // Mark touched for all containers so errors are visible
          for (const c of containers) markTouched(`container-${c.id}`)
          setServerErrors(errs)
          return
        }

        // No conflicts -> proceed with submit
        const data: CreateProcessDialogFormData = {
          reference: reference(),
          operationType: operationType(),
          origin: origin(),
          destination: destination(),
          containers: containers.filter((c) => c.containerNumber.trim()),
          carrier: carrier(),
          billOfLading: billOfLading(),
        }

        props.onSubmit?.(data)
        handleClose()
      } catch (err) {
        console.error('Failed to check containers before submit:', err)
        // In case of unexpected failures just block submit and show generic errors
        for (const c of containers) markTouched(`container-${c.id}`)
        setServerErrors(
          Object.fromEntries(
            containerNumbers.map((n, i) => [
              `container-${containers[i].id}`,
              { message: 'Failed to validate container' },
            ]),
          ),
        )
      }
    })()

    // Submission will continue from the async check above; no synchronous submit here
  }

  const handleClose = () => {
    // Reset form
    setReference('')
    setOperationType('unknown')
    setOrigin('')
    setDestination('')
    setContainers([createEmptyContainer()])
    setCarrier('unknown')
    setBillOfLading('')
    setTouched({})
    props.onClose()
  }

  // Derived state: detect duplicates and whether submit should be disabled
  const containerNumbersMemo = createMemo(() =>
    containers.map((c) => c.containerNumber.trim()).filter((n) => n.length > 0),
  )

  const duplicateList = createMemo(() => findDuplicateContainers(containerNumbersMemo()))

  const isSubmitDisabled = createMemo(() => {
    // disable when no valid containers or duplicates present
    if (!hasValidContainers()) return true
    if ((duplicateList() ?? []).length > 0) return true
    // disable when server-side errors are present
    if (Object.keys(serverErrors() ?? {}).length > 0) return true
    return false
  })

  // Tooltip text to show when the submit is disabled: prefer duplicate message, otherwise required message
  const submitTooltip = createMemo(() => {
    if (!isSubmitDisabled()) return ''
    const dups = duplicateList()
    if (dups && dups.length > 0) {
      return `${t(keys.duplicateContainer)} (${dups[0]})`
    }
    // show server-side error if present
    const srvKeys = Object.keys(serverErrors() ?? {})
    if (srvKeys.length > 0) {
      return serverErrors()[srvKeys[0]]?.message ?? ''
    }
    if (!hasValidContainers()) {
      return t(keys.containerNumberRequired)
    }
    return ''
  })

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
                    <div>
                      <FormInput
                        label={`${t(keys.containerNumber)} ${index() + 1}`}
                        name={`container-${container.id}`}
                        value={container.containerNumber}
                        onInput={(v) => updateContainer(container.id, 'containerNumber', v)}
                        onBlur={async () => {
                          markTouched(`container-${container.id}`)
                          const val = container.containerNumber.trim()
                          // only check non-empty container numbers
                          if (!val) return

                          // When editing an existing process, skip server-side check for
                          // container numbers that were already present in the initial data
                          const normalized = val.toUpperCase().trim()
                          if (initialContainerNumbersSet().has(normalized)) return

                          try {
                            // reset any previous server error for this field
                            setServerErrors((prev) => {
                              const copy = { ...prev }
                              delete copy[`container-${container.id}`]
                              return copy
                            })

                            const res = await fetch('/api/processes/check', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ containers: [val.toUpperCase().trim()] }),
                            })
                            if (!res.ok) {
                              const txt = await res.text().catch(() => '')
                              setServerErrors((prev) => ({
                                ...prev,
                                [`container-${container.id}`]: {
                                  message: txt || 'Failed to validate container',
                                },
                              }))
                              return
                            }
                            const json = await res.json().catch(() => ({}))
                            const conflicts = json.conflicts || []
                            if (conflicts.length > 0) {
                              const c = conflicts[0]
                              setServerErrors((prev) => ({
                                ...prev,
                                [`container-${container.id}`]: {
                                  message:
                                    c.message ?? `Container ${c.containerNumber} already exists`,
                                  link: c.link,
                                },
                              }))
                            }
                          } catch (err) {
                            console.error('onBlur check failed', err)
                            setServerErrors((prev) => ({
                              ...prev,
                              [`container-${container.id}`]: {
                                message: 'Failed to validate container',
                              },
                            }))
                          }
                        }}
                        placeholder={t(keys.containerNumberPlaceholder)}
                        error={getContainerError(container) ?? getDuplicateError(container)}
                        required
                      />

                      {/* If server returned a link for this container, show it next to the error text */}
                      <Show when={serverErrors()[`container-${container.id}`]?.link}>
                        <p class="mt-1 text-xs text-slate-600 underline">
                          <button
                            type="button"
                            class="underline hover:cursor-pointer"
                            onClick={() => {
                              const linkUrl = serverErrors()[`container-${container.id}`]?.link
                              if (!linkUrl) return
                              const ok = window.confirm(
                                'Você perderá o progresso do formulário. Deseja continuar?',
                              )
                              if (ok) {
                                window.location.href = linkUrl
                              }
                            }}
                          >
                            {t('createProcess.action.existingProcessLink')}
                          </button>
                        </p>
                      </Show>
                    </div>

                    <div>
                      <FormInput
                        label={t(keys.isoType)}
                        name={`iso-${container.id}`}
                        value={container.isoType}
                        onInput={(v) => updateContainer(container.id, 'isoType', v)}
                        placeholder={t(keys.isoTypePlaceholder)}
                      />
                    </div>
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
              value={billOfLading()}
              onInput={setBillOfLading}
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
            disabled={isSubmitDisabled()}
            aria-disabled={isSubmitDisabled()}
            title={isSubmitDisabled() ? submitTooltip() : undefined}
            class={`inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
              isSubmitDisabled()
                ? 'opacity-50 cursor-not-allowed hover:bg-slate-900'
                : 'hover:bg-slate-800'
            }`}
          >
            {t(props.mode === 'edit' ? keys.update : keys.create)}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
