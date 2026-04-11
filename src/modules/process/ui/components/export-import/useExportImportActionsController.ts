import { createMemo, createSignal } from 'solid-js'
import toast from 'solid-toast'
import {
  executeSymmetricImportBundle,
  type ReportFormat,
  requestOperationalReportExport,
  requestOperationalReportExportText,
  requestPortableExport,
  validateSymmetricImportBundle,
} from '~/modules/process/ui/api/export-import.api'
import { useTranslation } from '~/shared/localization/i18n'
import { copyToClipboard } from '~/shared/utils/clipboard'

export type ExportType = 'portable' | 'report'

export type PortableFormat = 'json' | 'zip'

export type ImportValidationState = {
  readonly canImport: boolean
  readonly schemaVersion: string | null
  readonly processCount: number
  readonly containerCount: number
  readonly documentCount: number
  readonly databaseEmpty: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

type UseExportImportActionsControllerParams = {
  readonly processId: string | null
  readonly showImport: boolean
}

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
  if (value === 'trello') return 'trello'
  return 'json'
}

function parsePortableFormat(value: string): PortableFormat {
  if (value === 'zip') return 'zip'
  return 'json'
}

export function useExportImportActionsController(params: UseExportImportActionsControllerParams) {
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

  const scope = createMemo(() => resolveScope(params.processId))
  const canRunDryRun = createMemo(() => selectedBundle() !== null)
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
        const isTrelloFormat = reportFormat() === 'trello'
        await requestOperationalReportExport({
          scope: scope(),
          format: reportFormat(),
          options: {
            includeContainers: isTrelloFormat ? true : includeContainers(),
            includeAlerts: isTrelloFormat ? true : includeAlerts(),
            includeTimelineSummary: isTrelloFormat ? true : includeTimelineSummary(),
            includeExecutiveSummary: isTrelloFormat ? true : includeExecutiveSummary(),
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

  const handleCopyTrello = async () => {
    if (params.processId === null) return

    try {
      const markdown = await requestOperationalReportExportText({
        scope: scope(),
        format: 'trello',
        options: {
          includeContainers: true,
          includeAlerts: true,
          includeTimelineSummary: true,
          includeExecutiveSummary: true,
        },
      })
      const copied = await copyToClipboard(markdown)
      if (copied) {
        toast.success(t(keys.exportImport.copyTrelloSuccess))
      } else {
        toast.error(t(keys.exportImport.copyTrelloError))
      }
    } catch (error) {
      console.error('Failed to copy Trello export', error)
      toast.error(t(keys.exportImport.copyTrelloError))
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

  const importDisabled = true

  return {
    isExportDialogOpen,
    openExportDialog: () => setIsExportDialogOpen(true),
    closeExportDialog: () => setIsExportDialogOpen(false),
    exportType,
    setExportTypeFromInput: (value: string) => setExportType(parseExportType(value)),
    portableFormat,
    setPortableFormatFromInput: (value: string) => setPortableFormat(parsePortableFormat(value)),
    reportFormat,
    setReportFormatFromInput: (value: string) => setReportFormat(parseReportFormat(value)),
    includeContainers,
    setIncludeContainers,
    includeAlerts,
    setIncludeAlerts,
    includeTimelineSummary,
    setIncludeTimelineSummary,
    includeExecutiveSummary,
    setIncludeExecutiveSummary,
    exportError,
    isExporting,
    submitExport: handleExportSubmit,
    isImportDialogOpen,
    openImportDialog: () => setIsImportDialogOpen(true),
    closeImportDialog: () => setIsImportDialogOpen(false),
    handleBundleFileChange,
    runDryRun,
    executeImport,
    canRunDryRun,
    canExecuteImport,
    validation,
    isValidating,
    isImporting,
    importError,
    importSuccess,
    showCopyTrello: () => params.processId !== null,
    showImport: () => params.showImport && !importDisabled,
    copyTrello: handleCopyTrello,
  }
}
