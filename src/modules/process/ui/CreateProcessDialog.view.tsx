import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ContainerInput } from '~/modules/process/ui/CreateProcessDialog'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { FormInput, FormSelect } from '~/shared/ui/FormFields'

type ContainerSectionProps = {
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
  readonly smartPaste: SmartPasteProps
  readonly overwriteConfirmOpen: boolean
  readonly closeGuard: CloseGuardProps
}

type CloseGuardProps = {
  readonly open: boolean
  readonly target: 'form' | 'smartPaste' | null
  readonly onCancel: () => void
  readonly onConfirm: () => void
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

type SmartPasteProps = {
  readonly enabled: boolean
  readonly open: boolean
  readonly rawText: string
  readonly hasParsed: boolean
  readonly hasContainersDetected: boolean
  readonly detectedFields: readonly SmartPasteDetectedField[]
  readonly detectedContainers: readonly string[]
  readonly unmappedFields: readonly { readonly label: string; readonly value: string }[]
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

function SmartPasteTrigger(props: { readonly onOpen: () => void }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section class="rounded-lg border border-dashed border-border bg-surface-muted p-4">
      <div class="flex flex-col items-center justify-between gap-3">
        <div>
          <h3 class="text-sm-ui font-semibold text-foreground">
            {t(keys.createProcess.smartPaste.title)}
          </h3>
          <p class="mt-1 text-xs-ui text-text-muted">
            {t(keys.createProcess.smartPaste.description)}
          </p>
        </div>
        <div class="flex w-full ">
          <button
            type="button"
            onClick={() => props.onOpen()}
            class="inline-flex items-center rounded-md border border-control-border bg-control-bg px-3 py-1.5 text-sm-ui font-medium text-control-foreground transition-colors hover:border-control-border-hover hover:bg-control-bg-hover hover:text-control-foreground-strong"
          >
            {t(keys.createProcess.smartPaste.action.open)}
          </button>
        </div>
      </div>
    </section>
  )
}

function SmartPasteDetectedSection(props: {
  readonly detectedFields: readonly SmartPasteDetectedField[]
  readonly detectedContainers: readonly string[]
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section class="space-y-3 rounded-md border border-border bg-surface-muted p-4">
      <h4 class="text-sm-ui font-semibold text-foreground">
        {t(keys.createProcess.smartPaste.preview.detectedTitle)}
      </h4>

      <dl class="space-y-2">
        <For each={props.detectedFields}>
          {(field) => (
            <div>
              <dt class="text-xs-ui font-semibold uppercase tracking-wide text-text-muted">
                {field.label}
              </dt>
              <dd class="text-sm-ui text-foreground">{field.value}</dd>
            </div>
          )}
        </For>
      </dl>

      <div>
        <p class="text-xs-ui font-semibold uppercase tracking-wide text-text-muted">
          {t(keys.createProcess.smartPaste.preview.containersTitle)}
        </p>
        <ul class="mt-1 space-y-1">
          <For each={props.detectedContainers}>
            {(container) => <li class="text-sm-ui text-foreground">{container}</li>}
          </For>
        </ul>
      </div>
    </section>
  )
}

function SmartPasteUnmappedSection(props: {
  readonly unmappedFields: readonly { readonly label: string; readonly value: string }[]
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section class="space-y-2 rounded-md border border-tone-warning-border bg-tone-warning-bg p-4">
      <h4 class="text-sm-ui font-semibold text-tone-warning-strong">
        {t(keys.createProcess.smartPaste.preview.unmappedTitle)}
      </h4>
      <ul class="space-y-1">
        <For each={props.unmappedFields}>
          {(field) => (
            <li class="text-sm-ui text-tone-warning-fg">
              <span class="font-semibold">{field.label}:</span> {field.value || '-'}
            </li>
          )}
        </For>
      </ul>
    </section>
  )
}

function SmartPasteWarningsSection(props: { readonly warnings: readonly string[] }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section class="space-y-2 rounded-md border border-tone-danger-border bg-tone-danger-bg p-4">
      <h4 class="text-sm-ui font-semibold text-tone-danger-strong">
        {t(keys.createProcess.smartPaste.preview.warningTitle)}
      </h4>
      <ul class="space-y-1">
        <For each={props.warnings}>
          {(warning) => <li class="text-sm-ui text-tone-danger-fg">{warning}</li>}
        </For>
      </ul>
    </section>
  )
}

function SmartPasteRequiredFieldsSection(props: {
  readonly hasContainersDetected: boolean
  readonly detectedContainers: readonly string[]
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section class="space-y-2 rounded-md border border-border bg-surface p-4">
      <h4 class="text-sm-ui font-semibold text-foreground">
        {t(keys.createProcess.smartPaste.preview.requiredTitle)}
      </h4>
      <ul class="space-y-1 text-sm-ui text-foreground">
        <li>{t(keys.createProcess.smartPaste.preview.requiredCarrier)}</li>
        <Show
          when={props.hasContainersDetected}
          fallback={<li>{t(keys.createProcess.smartPaste.preview.requiredContainersMissing)}</li>}
        >
          <li>
            {t(keys.createProcess.smartPaste.preview.requiredContainersFound, {
              count: props.detectedContainers.length,
            })}
          </li>
        </Show>
      </ul>
    </section>
  )
}

function SmartPasteDialog(props: SmartPasteProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onClose()}
      title={t(keys.createProcess.smartPaste.dialogTitle)}
      description={t(keys.createProcess.smartPaste.dialogDescription)}
      maxWidth="xl"
    >
      <div class="space-y-4">
        <div class="space-y-1.5">
          <label
            for="smart-paste-input"
            class="block text-sm-ui font-medium text-control-foreground"
          >
            {t(keys.createProcess.smartPaste.pasteLabel)}
          </label>
          <textarea
            id="smart-paste-input"
            value={props.rawText}
            onInput={(event) => props.onTextInput(event.currentTarget.value)}
            class="min-h-48 block w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm-ui text-control-popover-foreground shadow-sm transition-colors placeholder:text-control-placeholder focus:border-control-selected-border focus:outline-none focus:ring-2 focus:ring-ring/40"
            placeholder={t(keys.createProcess.smartPaste.pastePlaceholder)}
          />
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-md px-3 py-2 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
          >
            {t(keys.createProcess.action.cancel)}
          </button>
          <button
            type="button"
            onClick={() => props.onAnalyze()}
            disabled={props.rawText.trim().length === 0}
            class={`inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground transition-colors ${
              props.rawText.trim().length === 0
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-primary-hover'
            }`}
          >
            {t(keys.createProcess.smartPaste.action.analyze)}
          </button>
        </div>

        <Show when={props.hasParsed}>
          <div class="space-y-3 border-t border-border pt-4">
            <SmartPasteDetectedSection
              detectedFields={props.detectedFields}
              detectedContainers={props.detectedContainers}
            />
            <Show when={props.unmappedFields.length > 0}>
              <SmartPasteUnmappedSection unmappedFields={props.unmappedFields} />
            </Show>
            <SmartPasteRequiredFieldsSection
              hasContainersDetected={props.hasContainersDetected}
              detectedContainers={props.detectedContainers}
            />
            <Show when={props.warnings.length > 0}>
              <SmartPasteWarningsSection warnings={props.warnings} />
            </Show>
            <Show when={props.applyErrorMessage.length > 0}>
              <p class="text-sm-ui text-tone-danger-fg" role="alert">
                {props.applyErrorMessage}
              </p>
            </Show>

            <div class="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => props.onClose()}
                class="rounded-md px-3 py-2 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
              >
                {t(keys.createProcess.action.cancel)}
              </button>
              <button
                type="button"
                onClick={() => props.onApply()}
                class="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                {t(keys.createProcess.smartPaste.action.apply)}
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}

function SmartPasteOverwriteConfirmDialog(props: {
  readonly open: boolean
  readonly conflicts: readonly SmartPasteConflictView[]
  readonly onCancel: () => void
  readonly onConfirm: () => void
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onCancel()}
      title={t(keys.createProcess.smartPaste.overwrite.title)}
      description={t(keys.createProcess.smartPaste.overwrite.description)}
      maxWidth="lg"
    >
      <div class="space-y-4">
        <ul class="space-y-3">
          <For each={props.conflicts}>
            {(conflict) => (
              <li class="rounded-md border border-border bg-surface-muted p-3">
                <p class="text-sm-ui font-semibold text-foreground">{conflict.fieldLabel}</p>
                <p class="mt-1 text-xs-ui text-text-muted">
                  {t(keys.createProcess.smartPaste.overwrite.currentValue)}: {conflict.currentValue}
                </p>
                <p class="text-xs-ui text-text-muted">
                  {t(keys.createProcess.smartPaste.overwrite.importedValue)}:{' '}
                  {conflict.importedValue}
                </p>
              </li>
            )}
          </For>
        </ul>

        <div class="flex items-center justify-end gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => props.onCancel()}
            class="rounded-md px-3 py-2 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
          >
            {t(keys.createProcess.smartPaste.action.keepCurrent)}
          </button>
          <button
            type="button"
            onClick={() => props.onConfirm()}
            class="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            {t(keys.createProcess.smartPaste.action.replaceAndApply)}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function CloseGuardDialog(props: CloseGuardProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onClose={() => props.onCancel()}
      title={t(keys.createProcess.closeGuard.title)}
      description={t(
        props.target === 'smartPaste'
          ? keys.createProcess.closeGuard.smartPasteDescription
          : keys.createProcess.closeGuard.formDescription,
      )}
      maxWidth="md"
    >
      <div class="flex items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => props.onCancel()}
          class="rounded-md px-3 py-2 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
        >
          {t(keys.createProcess.closeGuard.action.keepEditing)}
        </button>
        <button
          type="button"
          onClick={() => props.onConfirm()}
          class="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {t(keys.createProcess.closeGuard.action.discardAndClose)}
        </button>
      </div>
    </Dialog>
  )
}

function IdentificationSection(
  props: Omit<FormSectionsProps, 'containerSection' | 'sourceSection'>,
): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section>
      <h3 class="mb-4 text-sm-ui font-semibold uppercase tracking-wide text-text-muted">
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
      <h3 class="mb-1 text-sm-ui font-semibold uppercase tracking-wide text-text-muted">
        {t(keys.createProcess.section.route)}
      </h3>
      <p class="mb-4 text-xs-ui text-text-muted">{t(keys.createProcess.section.routeHelper)}</p>
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
      <h3 class="mb-4 text-sm-ui font-semibold uppercase tracking-wide text-text-muted">
        {t(keys.createProcess.section.containers)}
      </h3>
      <div class="space-y-3">
        <For each={props.containers}>
          {(container, index) => <ContainerRow container={container} index={index} {...props} />}
        </For>
      </div>

      <button
        type="button"
        onClick={() => props.onAddContainer()}
        class="mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
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

function ContainerRow(
  props: { container: ContainerInput; index: () => number } & ContainerSectionProps,
): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="flex items-start gap-3 rounded-lg border border-border bg-surface-muted p-4">
      <div class="flex-1">
        <FormInput
          label={`${t(keys.createProcess.field.containerNumber)} ${props.index() + 1}`}
          name={`container-${props.container.id}`}
          value={props.container.containerNumber}
          onInput={(value) => props.onUpdateContainer(props.container.id, value)}
          onPaste={(event) => props.onContainerPaste(props.container, event)}
          onBlur={() => props.onContainerBlur(props.container)}
          placeholder={t(keys.createProcess.field.containerNumberPlaceholder)}
          error={
            props.getContainerError(props.container) ?? props.getDuplicateError(props.container)
          }
          required
        />

        <Show when={props.getContainerLink(props.container)}>
          <p class="mt-1 text-xs-ui text-text-muted underline">
            <button
              type="button"
              class="underline hover:cursor-pointer"
              onClick={() => props.onOpenContainerLink(props.container)}
            >
              {t(keys.createProcess.action.existingProcessLink)}
            </button>
          </p>
        </Show>
      </div>

      <Show when={props.containers.length > 1}>
        <button
          type="button"
          onClick={() => props.onRemoveContainer(props.container.id)}
          class="mt-7 rounded-md p-1.5 text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
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
  )
}

function SourceSection(props: SourceSectionProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <section>
      <h3 class="mb-4 text-sm-ui font-semibold uppercase tracking-wide text-text-muted">
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
          <p class="mt-2 text-xs-ui text-text-muted">
            <Show
              when={props.carrier === 'unknown'}
              fallback={t(keys.createProcess.selectedCarrierHint)}
            >
              {t(keys.createProcess.unknownCarrierHint)}
            </Show>
          </p>
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
    <div class="flex items-center justify-end gap-3 border-t border-border pt-6">
      <button
        type="button"
        onClick={() => props.onClose()}
        class="rounded-md px-4 py-2 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong"
      >
        {t(keys.createProcess.action.cancel)}
      </button>
      <button
        type="submit"
        disabled={props.submitDisabled}
        aria-disabled={props.submitDisabled}
        title={props.submitDisabled ? props.submitTooltip : undefined}
        class={`inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm-ui font-medium text-primary-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 ${
          props.submitDisabled
            ? 'cursor-not-allowed opacity-50 hover:bg-primary'
            : 'hover:bg-primary-hover'
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
    <>
      <Dialog
        open={props.open}
        onClose={() => props.onClose()}
        title={t(props.mode === 'edit' ? keys.createProcess.titleEdit : keys.createProcess.title)}
        description={t(keys.createProcess.description)}
        maxWidth="xl"
      >
        <form onSubmit={(event) => props.onSubmit(event)} class="space-y-8">
          <Show when={props.smartPaste.enabled}>
            <SmartPasteTrigger onOpen={props.smartPaste.onOpen} />
          </Show>

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
            onContainerPaste={props.form.containerSection.onContainerPaste}
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

      <Show when={props.smartPaste.enabled && props.smartPaste.open && !props.overwriteConfirmOpen}>
        <SmartPasteDialog {...props.smartPaste} />
      </Show>

      <Show when={props.overwriteConfirmOpen}>
        <SmartPasteOverwriteConfirmDialog
          open={props.overwriteConfirmOpen}
          conflicts={props.smartPaste.conflicts}
          onCancel={props.smartPaste.onCancelOverwrite}
          onConfirm={props.smartPaste.onConfirmOverwrite}
        />
      </Show>

      <CloseGuardDialog {...props.closeGuard} />
    </>
  )
}
