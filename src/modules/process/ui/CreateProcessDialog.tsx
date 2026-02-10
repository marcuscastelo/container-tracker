import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { findDuplicateContainers } from '~/modules/process/domain/processStuff'
import type { Carrier } from '~/modules/process/domain/value-objects'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { FormInput, FormSelect } from '~/shared/ui/FormFields'

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
  // Optional field to autofocus when the dialog opens. If omitted, no special focus is applied.
  // Allowed values: 'reference' | 'carrier'
  // which field should receive focus when the dialog opens (optional)
  readonly focus?: 'reference' | 'carrier' | null | undefined
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 11)
}

function createEmptyContainer(): ContainerInput {
  return { id: generateId(), containerNumber: '' }
}

export function CreateProcessDialog(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  // Form state
  const [reference, setReference] = createSignal('')
  const [origin, setOrigin] = createSignal('')
  const [destination, setDestination] = createSignal('')
  const [containers, setContainers] = createStore<ContainerInput[]>([createEmptyContainer()])
  // carrier can be an empty string while the user hasn't chosen a carrier yet.
  // We use a narrow type here and guard before submitting so the rest of the app
  // still works with the strict `Carrier` type.
  const [carrier, setCarrier] = createSignal<Carrier | ''>('')
  const [billOfLading, setBillOfLading] = createSignal('')
  const [bookingNumber, setBookingNumber] = createSignal('')
  const [importerName, setImporterName] = createSignal('')
  const [exporterName, setExporterName] = createSignal('')
  const [referenceImporter, setReferenceImporter] = createSignal('')
  const [product, setProduct] = createSignal('')
  const [redestinationNumber, setRedestinationNumber] = createSignal('')
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
      setOrigin(props.initialData.origin || '')
      setDestination(props.initialData.destination || '')
      // When editing, populate carrier; otherwise keep empty so user must choose.
      setCarrier(props.initialData.carrier ?? '')
      setBillOfLading(props.initialData.billOfLading || '')
      setBookingNumber(props.initialData.bookingNumber || '')
      setImporterName(props.initialData.importerName || '')
      setExporterName(props.initialData.exporterName || '')
      setReferenceImporter(props.initialData.referenceImporter || '')
      setProduct(props.initialData.product || '')
      setRedestinationNumber(props.initialData.redestinationNumber || '')
      setContainers(
        props.initialData.containers.length
          ? props.initialData.containers.map((c) => ({
            id: c.id,
            containerNumber: c.containerNumber,
          }))
          : [createEmptyContainer()],
      )

      // Optionally autofocus a specific field when requested by the caller
      if (props.focus) {
        // schedule after next tick so input/select is mounted
        setTimeout(() => {
          try {
            if (props.focus === 'reference') {
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
            } else if (props.focus === 'carrier') {
              const el = document.getElementById('carrier')
              if (el instanceof HTMLSelectElement) {
                el.focus()
              }
            }
          } catch {
            /* ignore */
          }
        }, 0)
      }
    }
  })

  // Narrowing guard so TypeScript knows a string value is a valid Carrier
  const isCarrier = (v: string): v is Carrier =>
    ['maersk', 'msc', 'cmacgm', 'hapag', 'one', 'evergreen', 'unknown'].includes(v)

  const carrierOptions = () => [
    { value: 'maersk', label: 'Maersk' },
    { value: 'msc', label: 'MSC' },
    { value: 'cmacgm', label: 'CMA CGM' },
    { value: 'unknown', label: t(keys.createProcess.carrierUnknown) },
  ]

  const updateContainer = (id: string, field: 'containerNumber', value: string) => {
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
      return t(keys.createProcess.validation.containerNumberRequired)
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
      return `${t(keys.createProcess.validation.duplicateContainer)} (${thisNum})`
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
    void (async () => {
      try {
        // Reset previous server errors
        setServerErrors({})

        // If nothing to check (e.g., editing without adding new containers), skip server check
        if (containerNumbersForCheck.length === 0) {
          // proceed with submit
          // Ensure carrier is a valid Carrier value before submitting
          const carrierValue = carrier()
          if (!isCarrier(carrierValue)) return

          const data: CreateProcessDialogFormData = {
            reference: reference(),
            origin: origin(),
            destination: destination(),
            containers: containers.filter((c) => c.containerNumber.trim()),
            carrier: carrierValue,
            billOfLading: billOfLading(),
            bookingNumber: bookingNumber(),
            importerName: importerName(),
            exporterName: exporterName(),
            referenceImporter: referenceImporter(),
            product: product(),
            redestinationNumber: redestinationNumber(),
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
              containerNumbers.map((_n, i) => [
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
        const carrierValue = carrier()
        if (!isCarrier(carrierValue)) return

        const data: CreateProcessDialogFormData = {
          reference: reference(),
          origin: origin(),
          destination: destination(),
          containers: containers.filter((c) => c.containerNumber.trim()),
          carrier: carrierValue,
          billOfLading: billOfLading(),
          bookingNumber: bookingNumber(),
          importerName: importerName(),
          exporterName: exporterName(),
          referenceImporter: referenceImporter(),
          product: product(),
          redestinationNumber: redestinationNumber(),
        }

        props.onSubmit?.(data)
        handleClose()
      } catch (err) {
        console.error('Failed to check containers before submit:', err)
        // In case of unexpected failures just block submit and show generic errors
        for (const c of containers) markTouched(`container-${c.id}`)
        setServerErrors(
          Object.fromEntries(
            containerNumbers.map((_n, i) => [
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
    setOrigin('')
    setDestination('')
    setContainers([createEmptyContainer()])
    // Reset to the initial placeholder state so user must re-select a carrier
    setCarrier('')
    setBillOfLading('')
    setBookingNumber('')
    setImporterName('')
    setExporterName('')
    setReferenceImporter('')
    setProduct('')
    setRedestinationNumber('')
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
    // require carrier to be explicitly chosen (placeholder is empty string)
    if (carrier() === '') return true
    // disable when server-side errors are present
    if (Object.keys(serverErrors() ?? {}).length > 0) return true
    return false
  })

  // Tooltip text to show when the submit is disabled: prefer duplicate message, otherwise required message
  const submitTooltip = createMemo(() => {
    if (!isSubmitDisabled()) return ''
    const dups = duplicateList()
    if (dups && dups.length > 0) {
      return `${t(keys.createProcess.validation.duplicateContainer)} (${dups[0]})`
    }
    // show server-side error if present
    const srvKeys = Object.keys(serverErrors() ?? {})
    if (srvKeys.length > 0) {
      return serverErrors()[srvKeys[0]]?.message ?? ''
    }
    // require carrier selection
    if (carrier() === '') return t(keys.createProcess.field.carrierPlaceholder)
    if (!hasValidContainers()) {
      return t(keys.createProcess.validation.containerNumberRequired)
    }
    return ''
  })

  return (
    <Dialog
      open={props.open}
      onClose={handleClose}
      title={t(props.mode === 'edit' ? keys.createProcess.titleEdit : keys.createProcess.title)}
      description={t(keys.createProcess.description)}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} class="space-y-8">
        {/* Section: Identification */}
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.createProcess.section.identification)}
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormInput
              label={t(keys.createProcess.field.reference)}
              name="reference"
              value={reference()}
              onInput={setReference}
              placeholder={t(keys.createProcess.field.referencePlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.importerName)}
              name="importerName"
              value={importerName()}
              onInput={setImporterName}
              placeholder={t(keys.createProcess.field.importerNamePlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.exporterName)}
              name="exporterName"
              value={exporterName()}
              onInput={setExporterName}
              placeholder={t(keys.createProcess.field.exporterNamePlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.referenceImporter)}
              name="referenceImporter"
              value={referenceImporter()}
              onInput={setReferenceImporter}
              placeholder={t(keys.createProcess.field.referenceImporterPlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.product)}
              name="product"
              value={product()}
              onInput={setProduct}
              placeholder={t(keys.createProcess.field.productPlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.redestinationNumber)}
              name="redestinationNumber"
              value={redestinationNumber()}
              onInput={setRedestinationNumber}
              placeholder={t(keys.createProcess.field.redestinationNumberPlaceholder)}
            />
          </div>
        </section>

        {/* Section: Planned Route */}
        <section>
          <h3 class="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.createProcess.section.route)}
          </h3>
          <p class="mb-4 text-xs text-slate-400">{t(keys.createProcess.section.routeHelper)}</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormInput
              label={t(keys.createProcess.field.origin)}
              name="origin"
              value={origin()}
              onInput={setOrigin}
              placeholder={t(keys.createProcess.field.originPlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.destination)}
              name="destination"
              value={destination()}
              onInput={setDestination}
              placeholder={t(keys.createProcess.field.destinationPlaceholder)}
            />
          </div>
        </section>

        {/* Section: Containers */}
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.createProcess.section.containers)}
          </h3>
          <div class="space-y-3">
            <For each={containers}>
              {(container, index) => (
                <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div class="flex-1">
                    <FormInput
                      label={`${t(keys.createProcess.field.containerNumber)} ${index() + 1}`}
                      name={`container-${container.id}`}
                      value={container.containerNumber}
                      onInput={(v) => updateContainer(container.id, 'containerNumber', v)}
                      onBlur={() => {
                        markTouched(`container-${container.id}`)
                        const val = container.containerNumber.trim()
                        // only check non-empty container numbers
                        if (!val) return

                        // When editing an existing process, skip server-side check for
                        // container numbers that were already present in the initial data
                        const normalized = val.toUpperCase().trim()
                        if (initialContainerNumbersSet().has(normalized)) return

                        void (async () => {
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
                        })()
                      }}
                      placeholder={t(keys.createProcess.field.containerNumberPlaceholder)}
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
                          {t(keys.createProcess.action.existingProcessLink)}
                        </button>
                      </p>
                    </Show>
                  </div>
                  {containers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContainer(container.id)}
                      class="mt-7 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
                      aria-label={t(keys.createProcess.action.removeContainer)}
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
            {t(keys.createProcess.action.addContainer)}
          </button>
        </section>

        {/* Section: Source / Integration */}
        <section>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t(keys.createProcess.section.source)}
          </h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <FormSelect
                label={t(keys.createProcess.field.carrier)}
                name="carrier"
                value={carrier()}
                onInput={setCarrier}
                options={carrierOptions()}
                placeholder={t(keys.createProcess.field.carrierPlaceholder)}
                required
              />
              <Show when={carrier() === 'unknown'}>
                <p class="mt-2 text-xs text-slate-500">
                  {t(keys.createProcess.unknownCarrierWarning)}
                </p>
              </Show>
            </div>
            <FormInput
              label={t(keys.createProcess.field.billOfLading)}
              name="billOfLading"
              value={billOfLading()}
              onInput={setBillOfLading}
              placeholder={t(keys.createProcess.field.billOfLadingPlaceholder)}
            />
            <FormInput
              label={t(keys.createProcess.field.bookingNumber)}
              name="bookingNumber"
              value={bookingNumber()}
              onInput={setBookingNumber}
              placeholder={t(keys.createProcess.field.bookingNumberPlaceholder)}
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
            {t(keys.createProcess.action.cancel)}
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled()}
            aria-disabled={isSubmitDisabled()}
            title={isSubmitDisabled() ? submitTooltip() : undefined}
            class={`inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${isSubmitDisabled()
              ? 'opacity-50 cursor-not-allowed hover:bg-slate-900'
              : 'hover:bg-slate-800'
              }`}
          >
            {t(
              props.mode === 'edit'
                ? keys.createProcess.action.update
                : keys.createProcess.action.create,
            )}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
