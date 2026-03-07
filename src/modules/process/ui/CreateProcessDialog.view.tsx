import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ContainerInput } from '~/modules/process/ui/CreateProcessDialog'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { FormInput, FormSelect } from '~/shared/ui/FormFields'

type ContainerSectionProps = {
  readonly containers: readonly ContainerInput[]
  readonly onUpdateContainer: (id: string, value: string) => void
  readonly onContainerBlur: (container: ContainerInput) => void
  readonly onRemoveContainer: (id: string) => void
  readonly onAddContainer: () => void
  readonly getContainerError: (container: ContainerInput) => string | undefined
  readonly getDuplicateError: (container: ContainerInput) => string | undefined
  readonly getContainerLink: (container: ContainerInput) => string | undefined
  readonly onOpenContainerLink: (container: ContainerInput) => void
}

type SourceSectionProps = {
  readonly carrier: string
  readonly onCarrierInput: (value: string) => void
  readonly carrierOptions: readonly { value: string; label: string }[]
  readonly billOfLading: string
  readonly onBillOfLadingInput: (value: string) => void
  readonly bookingNumber: string
  readonly onBookingNumberInput: (value: string) => void
}

type FormSectionsProps = {
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
  readonly containerSection: ContainerSectionProps
  readonly sourceSection: SourceSectionProps
}

type Props = {
  readonly open: boolean
  readonly mode?: 'create' | 'edit'
  readonly onClose: () => void
  readonly onSubmit: (event: Event) => void
  readonly form: FormSectionsProps
  readonly submitDisabled: boolean
  readonly submitTooltip: string
}

function IdentificationSection(
  props: Omit<FormSectionsProps, 'containerSection' | 'sourceSection'>,
): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section>
      <h3 class="mb-4 text-md-ui font-semibold uppercase tracking-wide text-slate-500">
        {t(keys.createProcess.section.identification)}
      </h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <FormInput
          label={t(keys.createProcess.field.reference)}
          name="reference"
          value={props.reference}
          onInput={props.onReferenceInput}
          placeholder={t(keys.createProcess.field.referencePlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.importerName)}
          name="importerName"
          value={props.importerName}
          onInput={props.onImporterNameInput}
          placeholder={t(keys.createProcess.field.importerNamePlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.exporterName)}
          name="exporterName"
          value={props.exporterName}
          onInput={props.onExporterNameInput}
          placeholder={t(keys.createProcess.field.exporterNamePlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.referenceImporter)}
          name="referenceImporter"
          value={props.referenceImporter}
          onInput={props.onReferenceImporterInput}
          placeholder={t(keys.createProcess.field.referenceImporterPlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.product)}
          name="product"
          value={props.product}
          onInput={props.onProductInput}
          placeholder={t(keys.createProcess.field.productPlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.redestinationNumber)}
          name="redestinationNumber"
          value={props.redestinationNumber}
          onInput={props.onRedestinationNumberInput}
          placeholder={t(keys.createProcess.field.redestinationNumberPlaceholder)}
        />
      </div>
    </section>
  )
}

function RouteSection(
  props: Pick<FormSectionsProps, 'origin' | 'onOriginInput' | 'destination' | 'onDestinationInput'>,
): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section>
      <h3 class="mb-1 text-md-ui font-semibold uppercase tracking-wide text-slate-500">
        {t(keys.createProcess.section.route)}
      </h3>
      <p class="mb-4 text-xs-ui text-slate-400">{t(keys.createProcess.section.routeHelper)}</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <FormInput
          label={t(keys.createProcess.field.origin)}
          name="origin"
          value={props.origin}
          onInput={props.onOriginInput}
          placeholder={t(keys.createProcess.field.originPlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.destination)}
          name="destination"
          value={props.destination}
          onInput={props.onDestinationInput}
          placeholder={t(keys.createProcess.field.destinationPlaceholder)}
        />
      </div>
    </section>
  )
}

function ContainersSection(props: ContainerSectionProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section>
      <h3 class="mb-4 text-md-ui font-semibold uppercase tracking-wide text-slate-500">
        {t(keys.createProcess.section.containers)}
      </h3>
      <div class="space-y-3">
        <For each={props.containers}>
          {(container, index) => (
            <div class="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div class="flex-1">
                <FormInput
                  label={`${t(keys.createProcess.field.containerNumber)} ${index() + 1}`}
                  name={`container-${container.id}`}
                  value={container.containerNumber}
                  onInput={(value) => props.onUpdateContainer(container.id, value)}
                  onBlur={() => props.onContainerBlur(container)}
                  placeholder={t(keys.createProcess.field.containerNumberPlaceholder)}
                  error={props.getContainerError(container) ?? props.getDuplicateError(container)}
                  required
                />

                <Show when={props.getContainerLink(container)}>
                  <p class="mt-1 text-xs-ui text-slate-600 underline">
                    <button
                      type="button"
                      class="underline hover:cursor-pointer"
                      onClick={() => props.onOpenContainerLink(container)}
                    >
                      {t(keys.createProcess.action.existingProcessLink)}
                    </button>
                  </p>
                </Show>
              </div>

              <Show when={props.containers.length > 1}>
                <button
                  type="button"
                  onClick={() => props.onRemoveContainer(container.id)}
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
              </Show>
            </div>
          )}
        </For>
      </div>

      <button
        type="button"
        onClick={() => props.onAddContainer()}
        class="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-md-ui font-medium text-slate-600 transition-colors hover:bg-slate-100"
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
  )
}

function SourceSection(props: SourceSectionProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section>
      <h3 class="mb-4 text-md-ui font-semibold uppercase tracking-wide text-slate-500">
        {t(keys.createProcess.section.source)}
      </h3>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <FormSelect
            label={t(keys.createProcess.field.carrier)}
            name="carrier"
            value={props.carrier}
            onInput={props.onCarrierInput}
            options={props.carrierOptions}
            placeholder={t(keys.createProcess.field.carrierPlaceholder)}
            required
          />
          <Show when={props.carrier === 'unknown'}>
            <p class="mt-2 text-xs-ui text-slate-500">{t(keys.createProcess.unknownCarrierWarning)}</p>
          </Show>
        </div>
        <FormInput
          label={t(keys.createProcess.field.billOfLading)}
          name="billOfLading"
          value={props.billOfLading}
          onInput={props.onBillOfLadingInput}
          placeholder={t(keys.createProcess.field.billOfLadingPlaceholder)}
        />
        <FormInput
          label={t(keys.createProcess.field.bookingNumber)}
          name="bookingNumber"
          value={props.bookingNumber}
          onInput={props.onBookingNumberInput}
          placeholder={t(keys.createProcess.field.bookingNumberPlaceholder)}
        />
      </div>
    </section>
  )
}

function ActionsSection(props: {
  readonly mode?: 'create' | 'edit'
  readonly onClose: () => void
  readonly submitDisabled: boolean
  readonly submitTooltip: string
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="flex items-center justify-end gap-3 border-t border-slate-200 pt-6">
      <button
        type="button"
        onClick={() => props.onClose()}
        class="rounded-md px-4 py-2 text-md-ui font-medium text-slate-600 transition-colors hover:bg-slate-100"
      >
        {t(keys.createProcess.action.cancel)}
      </button>
      <button
        type="submit"
        disabled={props.submitDisabled}
        aria-disabled={props.submitDisabled}
        title={props.submitDisabled ? props.submitTooltip : undefined}
        class={`inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-md-ui font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
          props.submitDisabled
            ? 'cursor-not-allowed opacity-50 hover:bg-slate-900'
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
  )
}

export function CreateProcessDialogView(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onClose()}
      title={t(props.mode === 'edit' ? keys.createProcess.titleEdit : keys.createProcess.title)}
      description={t(keys.createProcess.description)}
      maxWidth="xl"
    >
      <form onSubmit={(event) => props.onSubmit(event)} class="space-y-8">
        <IdentificationSection
          reference={props.form.reference}
          onReferenceInput={props.form.onReferenceInput}
          importerName={props.form.importerName}
          onImporterNameInput={props.form.onImporterNameInput}
          exporterName={props.form.exporterName}
          onExporterNameInput={props.form.onExporterNameInput}
          referenceImporter={props.form.referenceImporter}
          onReferenceImporterInput={props.form.onReferenceImporterInput}
          product={props.form.product}
          onProductInput={props.form.onProductInput}
          redestinationNumber={props.form.redestinationNumber}
          onRedestinationNumberInput={props.form.onRedestinationNumberInput}
          origin={props.form.origin}
          onOriginInput={props.form.onOriginInput}
          destination={props.form.destination}
          onDestinationInput={props.form.onDestinationInput}
        />

        <RouteSection
          origin={props.form.origin}
          onOriginInput={props.form.onOriginInput}
          destination={props.form.destination}
          onDestinationInput={props.form.onDestinationInput}
        />

        <ContainersSection
          containers={props.form.containerSection.containers}
          onUpdateContainer={props.form.containerSection.onUpdateContainer}
          onContainerBlur={props.form.containerSection.onContainerBlur}
          onRemoveContainer={props.form.containerSection.onRemoveContainer}
          onAddContainer={props.form.containerSection.onAddContainer}
          getContainerError={props.form.containerSection.getContainerError}
          getDuplicateError={props.form.containerSection.getDuplicateError}
          getContainerLink={props.form.containerSection.getContainerLink}
          onOpenContainerLink={props.form.containerSection.onOpenContainerLink}
        />

        <SourceSection
          carrier={props.form.sourceSection.carrier}
          onCarrierInput={props.form.sourceSection.onCarrierInput}
          carrierOptions={props.form.sourceSection.carrierOptions}
          billOfLading={props.form.sourceSection.billOfLading}
          onBillOfLadingInput={props.form.sourceSection.onBillOfLadingInput}
          bookingNumber={props.form.sourceSection.bookingNumber}
          onBookingNumberInput={props.form.sourceSection.onBookingNumberInput}
        />

        <ActionsSection
          mode={props.mode}
          onClose={props.onClose}
          submitDisabled={props.submitDisabled}
          submitTooltip={props.submitTooltip}
        />
      </form>
    </Dialog>
  )
}
