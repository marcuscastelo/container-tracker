import { Check, Copy, Download, Upload } from 'lucide-solid'
import { createSignal, For, type JSX, onCleanup, onMount, Show } from 'solid-js'
import type { ReportFormat } from '~/modules/process/ui/api/export-import.api'
import {
  type ExportType,
  type ImportValidationState,
  type PortableFormat,
  useExportImportActionsController,
} from '~/modules/process/ui/components/export-import/useExportImportActionsController'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'

type ExportImportActionsProps = {
  readonly processId: string | null
  readonly showImport: boolean
}

type ExportImportMenuProps = {
  readonly showImport: boolean
  readonly showCopyTrello: boolean
  readonly copyTrelloFeedback: boolean
  readonly onOpenExport: () => void
  readonly onOpenImport: () => void
  readonly onCopyTrello: () => void
}

const HEADER_MENU_BUTTON_CLASS =
  'motion-focus-surface motion-interactive inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] cursor-pointer list-none items-center justify-center gap-1.5 rounded-[var(--dashboard-control-radius)] border border-border bg-surface px-2.5 text-sm-ui font-medium text-text-muted select-none hover:border-border-strong hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

const HEADER_MENU_ITEM_CLASS =
  'motion-focus-surface motion-interactive flex w-full items-center gap-2 px-3 py-2 text-left text-sm-ui font-medium text-foreground hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none'

function CopyTrelloMenuItem(props: {
  readonly copied: boolean
  readonly onClick: () => void
}): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <button type="button" class={HEADER_MENU_ITEM_CLASS} onClick={() => props.onClick()}>
      <Show
        when={props.copied}
        fallback={<Copy class="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />}
      >
        <Check
          class="motion-copy-feedback h-4 w-4 shrink-0 text-tone-success-fg"
          aria-hidden="true"
        />
      </Show>
      <span class="motion-copy-feedback" data-state={props.copied ? 'copied' : 'idle'}>
        {props.copied
          ? t(keys.exportImport.copyTrelloCopied)
          : t(keys.exportImport.copyTrelloAction)}
      </span>
    </button>
  )
}

function ExportImportMenu(props: ExportImportMenuProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [isMenuOpen, setIsMenuOpen] = createSignal(false)
  let menuRef: HTMLDivElement | undefined

  const closeMenu = (): void => {
    setIsMenuOpen(false)
  }

  const handleExportClick = (): void => {
    closeMenu()
    props.onOpenExport()
  }

  const handleImportClick = (): void => {
    closeMenu()
    props.onOpenImport()
  }

  const handleCopyTrelloClick = (): void => {
    closeMenu()
    props.onCopyTrello()
  }

  onMount(() => {
    const onDocClick: EventListener = (ev) => {
      if (!menuRef) return
      if (!isMenuOpen()) return
      const target = ev.target
      if (target instanceof Node && menuRef.contains(target)) return
      setIsMenuOpen(false)
    }

    const onEscape = (event: KeyboardEvent) => {
      if (!isMenuOpen()) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      setIsMenuOpen(false)
    }

    const onOtherOpened: EventListener = (ev) => {
      if (!menuRef) return
      if (!(ev instanceof CustomEvent)) return
      if (ev.detail !== menuRef) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onEscape)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)

    onCleanup(() => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onEscape)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
    })
  })

  return (
    <div
      ref={(el) => {
        if (el instanceof HTMLDivElement) menuRef = el
        else menuRef = undefined
      }}
      class="group relative"
      data-testid="export-import-actions-menu"
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen()}
        aria-label={t(keys.exportImport.moreActions)}
        title={t(keys.exportImport.moreActions)}
        data-state={isMenuOpen() ? 'open' : 'closed'}
        class={HEADER_MENU_BUTTON_CLASS}
        onClick={() => {
          const nextOpen = !isMenuOpen()
          setIsMenuOpen(nextOpen)
          if (nextOpen) {
            window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: menuRef }))
          }
        }}
      >
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
        <span class="sr-only">{t(keys.exportImport.moreActions)}</span>
      </button>

      <div
        class="motion-dropdown-panel motion-overlay-surface absolute right-0 top-full z-20 mt-1 min-w-56 overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        data-state={isMenuOpen() ? 'open' : 'closed'}
      >
        <div class="divide-y divide-border py-1">
          <Show when={props.showCopyTrello}>
            <CopyTrelloMenuItem copied={props.copyTrelloFeedback} onClick={handleCopyTrelloClick} />
          </Show>

          <Show when={props.showImport}>
            <button type="button" class={HEADER_MENU_ITEM_CLASS} onClick={handleImportClick}>
              <Upload class="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
              {t(keys.exportImport.importButton)}
            </button>
          </Show>

          <button type="button" class={HEADER_MENU_ITEM_CLASS} onClick={handleExportClick}>
            <Download class="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
            {t(keys.exportImport.exportButton)}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImportValidationPanel(props: {
  readonly validation: ImportValidationState
  readonly blockedMessage: string
}): JSX.Element {
  const { t, keys } = useTranslation()
  const labels = {
    schemaVersion: t(keys.exportImport.importDialog.validation.schemaVersion),
    processes: t(keys.exportImport.importDialog.validation.processes),
    containers: t(keys.exportImport.importDialog.validation.containers),
    documents: t(keys.exportImport.importDialog.validation.documents),
    databaseEmpty: t(keys.exportImport.importDialog.validation.databaseEmpty),
    yes: t(keys.exportImport.importDialog.validation.yes),
    no: t(keys.exportImport.importDialog.validation.no),
    unavailable: t(keys.exportImport.importDialog.validation.valueUnavailable),
  }

  return (
    <div class="space-y-3 rounded-lg border border-border bg-surface-muted p-3">
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs-ui text-text-muted">
        <span>{labels.schemaVersion}</span>
        <span class="font-medium text-foreground">
          {props.validation.schemaVersion ?? labels.unavailable}
        </span>
        <span>{labels.processes}</span>
        <span class="font-medium text-foreground">{props.validation.processCount}</span>
        <span>{labels.containers}</span>
        <span class="font-medium text-foreground">{props.validation.containerCount}</span>
        <span>{labels.documents}</span>
        <span class="font-medium text-foreground">{props.validation.documentCount}</span>
        <span>{labels.databaseEmpty}</span>
        <span class="font-medium text-foreground">
          {props.validation.databaseEmpty ? labels.yes : labels.no}
        </span>
      </div>

      <Show when={!props.validation.databaseEmpty}>
        <p class="rounded-md border border-tone-warning-border bg-tone-warning-bg px-2 py-1 text-xs-ui text-tone-warning-fg">
          {props.blockedMessage}
        </p>
      </Show>

      <Show when={props.validation.errors.length > 0}>
        <ul class="list-disc space-y-1 pl-4 text-xs-ui text-tone-danger-fg">
          <For each={props.validation.errors}>{(error) => <li>{error}</li>}</For>
        </ul>
      </Show>

      <Show when={props.validation.warnings.length > 0}>
        <ul class="list-disc space-y-1 pl-4 text-xs-ui text-tone-warning-fg">
          <For each={props.validation.warnings}>{(warning) => <li>{warning}</li>}</For>
        </ul>
      </Show>
    </div>
  )
}

type ExportDialogProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly exportType: ExportType
  readonly onExportTypeChange: (value: string) => void
  readonly portableFormat: PortableFormat
  readonly onPortableFormatChange: (value: string) => void
  readonly reportFormat: ReportFormat
  readonly onReportFormatChange: (value: string) => void
  readonly includeContainers: boolean
  readonly onIncludeContainersChange: (checked: boolean) => void
  readonly includeAlerts: boolean
  readonly onIncludeAlertsChange: (checked: boolean) => void
  readonly includeTimelineSummary: boolean
  readonly onIncludeTimelineSummaryChange: (checked: boolean) => void
  readonly includeExecutiveSummary: boolean
  readonly onIncludeExecutiveSummaryChange: (checked: boolean) => void
  readonly exportError: string | null
  readonly isExporting: boolean
  readonly onSubmit: () => void
}

function ExportDialog(props: ExportDialogProps): JSX.Element {
  const { t, keys } = useTranslation()
  const isTrelloFormat = () => props.exportType === 'report' && props.reportFormat === 'trello'

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={t(keys.exportImport.dialog.title)}
      description={t(keys.exportImport.dialog.description)}
    >
      <div class="space-y-3">
        <label class="block space-y-1 text-sm-ui text-foreground">
          <span>{t(keys.exportImport.dialog.exportType)}</span>
          <select
            class="motion-focus-surface w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
            value={props.exportType}
            onInput={(event) => props.onExportTypeChange(event.currentTarget.value)}
          >
            <option value="portable">{t(keys.exportImport.dialog.typePortable)}</option>
            <option value="report">{t(keys.exportImport.dialog.typeReport)}</option>
          </select>
        </label>

        <Show
          when={props.exportType === 'portable'}
          fallback={
            <label class="block space-y-1 text-sm-ui text-foreground">
              <span>{t(keys.exportImport.dialog.format)}</span>
              <select
                class="motion-focus-surface w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
                value={props.reportFormat}
                onInput={(event) => props.onReportFormatChange(event.currentTarget.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="markdown">Markdown</option>
                <option value="pdf">PDF</option>
                <option value="trello">{t(keys.exportImport.dialog.formatTrello)}</option>
              </select>
            </label>
          }
        >
          <label class="block space-y-1 text-sm-ui text-foreground">
            <span>{t(keys.exportImport.dialog.format)}</span>
            <select
              class="motion-focus-surface w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
              value={props.portableFormat}
              onInput={(event) => props.onPortableFormatChange(event.currentTarget.value)}
            >
              <option value="json">JSON</option>
              <option value="zip">ZIP</option>
            </select>
          </label>
        </Show>

        <Show when={props.exportType === 'report' && !isTrelloFormat()}>
          <div class="space-y-2 rounded-md border border-border bg-surface-muted p-2 text-sm-ui text-foreground">
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={props.includeContainers}
                onChange={(event) => props.onIncludeContainersChange(event.currentTarget.checked)}
              />
              {t(keys.exportImport.dialog.includeContainers)}
            </label>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={props.includeAlerts}
                onChange={(event) => props.onIncludeAlertsChange(event.currentTarget.checked)}
              />
              {t(keys.exportImport.dialog.includeAlerts)}
            </label>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={props.includeTimelineSummary}
                onChange={(event) =>
                  props.onIncludeTimelineSummaryChange(event.currentTarget.checked)
                }
              />
              {t(keys.exportImport.dialog.includeTimelineSummary)}
            </label>
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={props.includeExecutiveSummary}
                onChange={(event) =>
                  props.onIncludeExecutiveSummaryChange(event.currentTarget.checked)
                }
              />
              {t(keys.exportImport.dialog.includeExecutiveSummary)}
            </label>
          </div>
        </Show>

        <Show when={props.exportError}>
          {(error) => (
            <p class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-2 py-1 text-xs-ui text-tone-danger-fg">
              {error()}
            </p>
          )}
        </Show>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="motion-focus-surface motion-interactive rounded-md px-3 py-2 text-sm-ui font-medium text-text-muted hover:bg-surface-muted"
            onClick={() => props.onClose()}
          >
            {t(keys.exportImport.dialog.cancel)}
          </button>
          <button
            type="button"
            class="motion-focus-surface motion-interactive rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.isExporting}
            onClick={() => props.onSubmit()}
          >
            {props.isExporting
              ? t(keys.exportImport.dialog.exporting)
              : t(keys.exportImport.dialog.confirmExport)}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

type ImportDialogProps = {
  readonly open: boolean
  readonly onClose: () => void
  readonly onFileChange: (event: Event) => void
  readonly onDryRun: () => void
  readonly onExecuteImport: () => void
  readonly isValidating: boolean
  readonly isImporting: boolean
  readonly canRunDryRun: boolean
  readonly canExecuteImport: boolean
  readonly validation: ImportValidationState | null
  readonly importError: string | null
  readonly importSuccess: string | null
}

function ImportDialog(props: ImportDialogProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={t(keys.exportImport.importDialog.title)}
      description={t(keys.exportImport.importDialog.description)}
    >
      <div class="space-y-3">
        <p class="rounded-md border border-tone-warning-border bg-tone-warning-bg px-2 py-2 text-xs-ui text-tone-warning-fg">
          {t(keys.exportImport.importDialog.warning)}
        </p>

        <label class="block space-y-1 text-sm-ui text-foreground">
          <span>{t(keys.exportImport.importDialog.selectBundle)}</span>
          <input
            type="file"
            accept="application/json"
            class="motion-focus-surface w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
            onChange={(event) => props.onFileChange(event)}
          />
        </label>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="motion-focus-surface motion-interactive rounded-md border border-border bg-surface px-3 py-2 text-sm-ui font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!props.canRunDryRun || props.isValidating}
            onClick={() => props.onDryRun()}
          >
            {props.isValidating
              ? t(keys.exportImport.importDialog.validating)
              : t(keys.exportImport.importDialog.runDryRun)}
          </button>
          <button
            type="button"
            class="motion-focus-surface motion-interactive rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.isImporting || !props.canExecuteImport}
            onClick={() => props.onExecuteImport()}
          >
            {props.isImporting
              ? t(keys.exportImport.importDialog.importing)
              : t(keys.exportImport.importDialog.executeImport)}
          </button>
        </div>

        <Show when={props.validation}>
          {(validation) => (
            <ImportValidationPanel
              validation={validation()}
              blockedMessage={t(keys.exportImport.importDialog.databaseNotEmpty)}
            />
          )}
        </Show>

        <Show when={props.importError}>
          {(error) => (
            <p class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-2 py-1 text-xs-ui text-tone-danger-fg">
              {error()}
            </p>
          )}
        </Show>

        <Show when={props.importSuccess}>
          {(message) => (
            <p class="rounded-md border border-tone-success-border bg-tone-success-bg px-2 py-1 text-xs-ui text-tone-success-fg">
              {message()}
            </p>
          )}
        </Show>
      </div>
    </Dialog>
  )
}

export function ExportImportActions(props: ExportImportActionsProps): JSX.Element {
  const controller = useExportImportActionsController(props)

  return (
    <>
      <ExportImportMenu
        showImport={controller.showImport()}
        showCopyTrello={controller.showCopyTrello()}
        copyTrelloFeedback={controller.copyTrelloFeedback()}
        onOpenExport={controller.openExportDialog}
        onOpenImport={controller.openImportDialog}
        onCopyTrello={controller.copyTrello}
      />

      <ExportDialog
        open={controller.isExportDialogOpen()}
        onClose={controller.closeExportDialog}
        exportType={controller.exportType()}
        onExportTypeChange={controller.setExportTypeFromInput}
        portableFormat={controller.portableFormat()}
        onPortableFormatChange={controller.setPortableFormatFromInput}
        reportFormat={controller.reportFormat()}
        onReportFormatChange={controller.setReportFormatFromInput}
        includeContainers={controller.includeContainers()}
        onIncludeContainersChange={controller.setIncludeContainers}
        includeAlerts={controller.includeAlerts()}
        onIncludeAlertsChange={controller.setIncludeAlerts}
        includeTimelineSummary={controller.includeTimelineSummary()}
        onIncludeTimelineSummaryChange={controller.setIncludeTimelineSummary}
        includeExecutiveSummary={controller.includeExecutiveSummary()}
        onIncludeExecutiveSummaryChange={controller.setIncludeExecutiveSummary}
        exportError={controller.exportError()}
        isExporting={controller.isExporting()}
        onSubmit={controller.submitExport}
      />

      <ImportDialog
        open={controller.isImportDialogOpen()}
        onClose={controller.closeImportDialog}
        onFileChange={controller.handleBundleFileChange}
        onDryRun={controller.runDryRun}
        onExecuteImport={controller.executeImport}
        isValidating={controller.isValidating()}
        isImporting={controller.isImporting()}
        canRunDryRun={controller.canRunDryRun()}
        canExecuteImport={controller.canExecuteImport()}
        validation={controller.validation()}
        importError={controller.importError()}
        importSuccess={controller.importSuccess()}
      />
    </>
  )
}
