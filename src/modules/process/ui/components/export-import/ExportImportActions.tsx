import { Download, Upload } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import {
  executeSymmetricImportBundle,
  type ReportFormat,
  requestOperationalReportExport,
  requestPortableExport,
  validateSymmetricImportBundle,
} from '~/modules/process/ui/api/export-import.api'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'

type ExportImportActionsProps = {
  readonly processId: string | null
  readonly showImport: boolean
}

type ExportType = 'portable' | 'report'

type PortableFormat = 'json' | 'zip'

type ImportValidationState = {
  readonly canImport: boolean
  readonly schemaVersion: string | null
  readonly processCount: number
  readonly containerCount: number
  readonly documentCount: number
  readonly databaseEmpty: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

const HEADER_MENU_BUTTON_CLASS =
  'inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] cursor-pointer list-none items-center justify-center gap-1.5 rounded-[var(--dashboard-control-radius)] border border-border bg-surface px-2.5 text-sm-ui font-medium text-text-muted transition-colors select-none hover:border-border-strong hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

const HEADER_MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm-ui font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none'

function readBundleFromFile(file: File): Promise<unknown> {
  return file.text().then((text) => JSON.parse(text))
}

function resolveScope(processId: string | null) {
  if (!processId) {
    return {
      scope: 'all_processes' as const,
      processId: null,
    }
  }

  return {
    scope: 'single_process' as const,
    processId,
  }
}

function parseExportType(value: string): ExportType {
  if (value === 'report') return 'report'
  return 'portable'
}

function parseReportFormat(value: string): ReportFormat {
  if (value === 'csv') return 'csv'
  if (value === 'xlsx') return 'xlsx'
  if (value === 'markdown') return 'markdown'
  if (value === 'pdf') return 'pdf'
  return 'json'
}

function parsePortableFormat(value: string): PortableFormat {
  if (value === 'zip') return 'zip'
  return 'json'
}

type ExportImportMenuProps = {
  readonly showImport: boolean
  readonly onOpenExport: () => void
  readonly onOpenImport: () => void
}

function ExportImportMenu(props: ExportImportMenuProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [isMenuOpen, setIsMenuOpen] = createSignal(false)
  let menuRef: HTMLDetailsElement | undefined

  const closeMenu = (): void => {
    if (!menuRef) {
      setIsMenuOpen(false)
      return
    }
    menuRef.open = false
  }

  const handleExportClick = (): void => {
    closeMenu()
    props.onOpenExport()
  }

  const handleImportClick = (): void => {
    closeMenu()
    props.onOpenImport()
  }

  onMount(() => {
    const onDocClick: EventListener = (ev) => {
      if (!menuRef) return
      if (!menuRef.open) return
      const target = ev.target
      if (target instanceof Node && menuRef.contains(target)) return
      menuRef.open = false
    }

    const onEscape = (event: KeyboardEvent) => {
      if (!menuRef?.open) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      menuRef.open = false
    }

    const onOtherOpened: EventListener = (ev) => {
      if (!menuRef) return
      if (!(ev instanceof CustomEvent)) return
      if (ev.detail !== menuRef) {
        menuRef.open = false
      }
    }

    const onToggle: EventListener = () => {
      if (!menuRef) return
      setIsMenuOpen(menuRef.open)
      if (menuRef.open) {
        window.dispatchEvent(new CustomEvent('unified-dropdown-opened', { detail: menuRef }))
      }
    }

    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onEscape)
    window.addEventListener('unified-dropdown-opened', onOtherOpened)
    menuRef?.addEventListener('toggle', onToggle)

    onCleanup(() => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onEscape)
      window.removeEventListener('unified-dropdown-opened', onOtherOpened)
      menuRef?.removeEventListener('toggle', onToggle)
    })
  })

  return (
    <details
      ref={(el) => {
        if (el instanceof HTMLDetailsElement) menuRef = el
        else menuRef = undefined
      }}
      class="group relative"
      data-testid="export-import-actions-menu"
    >
      <summary
        aria-haspopup="menu"
        aria-label={t(keys.exportImport.moreActions)}
        title={t(keys.exportImport.moreActions)}
        data-state={isMenuOpen() ? 'open' : 'closed'}
        class={HEADER_MENU_BUTTON_CLASS}
      >
        <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
        <span class="sr-only">{t(keys.exportImport.moreActions)}</span>
      </summary>

      <div class="absolute right-0 top-full z-20 mt-1 min-w-56 overflow-hidden rounded-md border border-border bg-surface shadow-lg">
        <div class="divide-y divide-border py-1">
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
    </details>
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
            class="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
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
                class="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
                value={props.reportFormat}
                onInput={(event) => props.onReportFormatChange(event.currentTarget.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="markdown">Markdown</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
          }
        >
          <label class="block space-y-1 text-sm-ui text-foreground">
            <span>{t(keys.exportImport.dialog.format)}</span>
            <select
              class="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
              value={props.portableFormat}
              onInput={(event) => props.onPortableFormatChange(event.currentTarget.value)}
            >
              <option value="json">JSON</option>
              <option value="zip">ZIP</option>
            </select>
          </label>
        </Show>

        <Show when={props.exportType === 'report'}>
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
            class="rounded-md px-3 py-2 text-sm-ui font-medium text-text-muted hover:bg-surface-muted"
            onClick={() => props.onClose()}
          >
            {t(keys.exportImport.dialog.cancel)}
          </button>
          <button
            type="button"
            class="rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
            class="w-full rounded-md border border-border bg-surface px-2 py-2 text-sm-ui"
            onChange={(event) => props.onFileChange(event)}
          />
        </label>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-md border border-border bg-surface px-3 py-2 text-sm-ui font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!props.canRunDryRun || props.isValidating}
            onClick={() => props.onDryRun()}
          >
            {props.isValidating
              ? t(keys.exportImport.importDialog.validating)
              : t(keys.exportImport.importDialog.runDryRun)}
          </button>
          <button
            type="button"
            class="rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
  const { t, keys } = useTranslation()

  const [isExportDialogOpen, setIsExportDialogOpen] = createSignal(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = createSignal(false)
  const [exportType, setExportType] = createSignal<ExportType>('portable')
  const [portableFormat, setPortableFormat] = createSignal<PortableFormat>('json')
  const [reportFormat, setReportFormat] = createSignal<ReportFormat>('json')
  const [includeContainers, setIncludeContainers] = createSignal(true)
  const [includeAlerts, setIncludeAlerts] = createSignal(true)
  const [includeTimelineSummary, setIncludeTimelineSummary] = createSignal(true)
  const [includeExecutiveSummary, setIncludeExecutiveSummary] = createSignal(true)
  const [exportError, setExportError] = createSignal<string | null>(null)
  const [isExporting, setIsExporting] = createSignal(false)

  const [selectedBundle, setSelectedBundle] = createSignal<unknown | null>(null)
  const [validation, setValidation] = createSignal<ImportValidationState | null>(null)
  const [isValidating, setIsValidating] = createSignal(false)
  const [isImporting, setIsImporting] = createSignal(false)
  const [importError, setImportError] = createSignal<string | null>(null)
  const [importSuccess, setImportSuccess] = createSignal<string | null>(null)

  const scope = createMemo(() => resolveScope(props.processId))
  const canExecuteImport = createMemo(() => {
    const currentValidation = validation()
    if (currentValidation === null) return false
    return currentValidation.canImport && currentValidation.databaseEmpty
  })

  const handleExportSubmit = async () => {
    setExportError(null)
    setIsExporting(true)

    try {
      if (exportType() === 'portable') {
        await requestPortableExport({ scope: scope(), format: portableFormat() })
      } else {
        await requestOperationalReportExport({
          scope: scope(),
          format: reportFormat(),
          options: {
            includeContainers: includeContainers(),
            includeAlerts: includeAlerts(),
            includeTimelineSummary: includeTimelineSummary(),
            includeExecutiveSummary: includeExecutiveSummary(),
          },
        })
      }

      setIsExportDialogOpen(false)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleBundleFileChange = async (event: Event) => {
    const target = event.currentTarget
    if (!(target instanceof HTMLInputElement)) return

    const file = target.files?.[0]
    if (!file) {
      setSelectedBundle(null)
      setValidation(null)
      return
    }

    try {
      const bundle = await readBundleFromFile(file)
      setSelectedBundle(bundle)
      setValidation(null)
      setImportError(null)
      setImportSuccess(null)
    } catch {
      setSelectedBundle(null)
      setValidation(null)
      setImportError(t(keys.exportImport.importDialog.invalidBundleJson))
    }
  }

  const runDryRun = async () => {
    const bundle = selectedBundle()
    if (!bundle) return

    setIsValidating(true)
    setImportError(null)
    setImportSuccess(null)

    try {
      const result = await validateSymmetricImportBundle({ bundle })
      setValidation(result)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import validation failed')
      setValidation(null)
    } finally {
      setIsValidating(false)
    }
  }

  const executeImport = async () => {
    const bundle = selectedBundle()
    const dryRun = validation()
    if (!bundle || !dryRun || !dryRun.canImport || !dryRun.databaseEmpty) return

    setIsImporting(true)
    setImportError(null)
    setImportSuccess(null)

    try {
      const result = await executeSymmetricImportBundle({ bundle })
      setImportSuccess(
        t(keys.exportImport.importDialog.importSuccess, {
          processes: result.importedProcesses,
          containers: result.importedContainers,
        }),
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import execution failed')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <>
      <ExportImportMenu
        showImport={props.showImport}
        onOpenExport={() => setIsExportDialogOpen(true)}
        onOpenImport={() => setIsImportDialogOpen(true)}
      />

      <ExportDialog
        open={isExportDialogOpen()}
        onClose={() => setIsExportDialogOpen(false)}
        exportType={exportType()}
        onExportTypeChange={(value) => setExportType(parseExportType(value))}
        portableFormat={portableFormat()}
        onPortableFormatChange={(value) => setPortableFormat(parsePortableFormat(value))}
        reportFormat={reportFormat()}
        onReportFormatChange={(value) => setReportFormat(parseReportFormat(value))}
        includeContainers={includeContainers()}
        onIncludeContainersChange={setIncludeContainers}
        includeAlerts={includeAlerts()}
        onIncludeAlertsChange={setIncludeAlerts}
        includeTimelineSummary={includeTimelineSummary()}
        onIncludeTimelineSummaryChange={setIncludeTimelineSummary}
        includeExecutiveSummary={includeExecutiveSummary()}
        onIncludeExecutiveSummaryChange={setIncludeExecutiveSummary}
        exportError={exportError()}
        isExporting={isExporting()}
        onSubmit={() => void handleExportSubmit()}
      />

      <ImportDialog
        open={isImportDialogOpen()}
        onClose={() => setIsImportDialogOpen(false)}
        onFileChange={handleBundleFileChange}
        onDryRun={() => void runDryRun()}
        onExecuteImport={() => void executeImport()}
        isValidating={isValidating()}
        isImporting={isImporting()}
        canRunDryRun={selectedBundle() !== null}
        canExecuteImport={canExecuteImport()}
        validation={validation()}
        importError={importError()}
        importSuccess={importSuccess()}
      />
    </>
  )
}
