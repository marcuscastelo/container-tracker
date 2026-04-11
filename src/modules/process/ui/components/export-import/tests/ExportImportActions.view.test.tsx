import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReportFormat } from '~/modules/process/ui/api/export-import.api'
import type {
  ExportType,
  ImportValidationState,
  PortableFormat,
} from '~/modules/process/ui/components/export-import/useExportImportActionsController'

const translationKeys = vi.hoisted(() => ({
  exportImport: {
    moreActions: 'More actions',
    copyTrelloAction: 'Copy Trello',
    importButton: 'Import bundle',
    exportButton: 'Export bundle',
    dialog: {
      title: 'Export dialog',
      description: 'Export data',
      exportType: 'Export type',
      typePortable: 'Portable',
      typeReport: 'Report',
      format: 'Format',
      formatTrello: 'Trello',
      includeContainers: 'Include containers',
      includeAlerts: 'Include alerts',
      includeTimelineSummary: 'Include timeline summary',
      includeExecutiveSummary: 'Include executive summary',
      cancel: 'Cancel',
      exporting: 'Exporting',
      confirmExport: 'Confirm export',
    },
    importDialog: {
      title: 'Import dialog',
      description: 'Import data',
      warning: 'Import warning',
      selectBundle: 'Select bundle',
      validating: 'Validating',
      runDryRun: 'Run dry run',
      importing: 'Importing',
      executeImport: 'Execute import',
      databaseNotEmpty: 'Database not empty',
      validation: {
        schemaVersion: 'Schema version',
        processes: 'Processes',
        containers: 'Containers',
        documents: 'Documents',
        databaseEmpty: 'Database empty',
        yes: 'Yes',
        no: 'No',
        valueUnavailable: 'Unavailable',
      },
    },
  },
}))

type ExportImportControllerStub = {
  isExportDialogOpen: () => boolean
  openExportDialog: ReturnType<typeof vi.fn>
  closeExportDialog: ReturnType<typeof vi.fn>
  exportType: () => ExportType
  setExportTypeFromInput: ReturnType<typeof vi.fn>
  portableFormat: () => PortableFormat
  setPortableFormatFromInput: ReturnType<typeof vi.fn>
  reportFormat: () => ReportFormat
  setReportFormatFromInput: ReturnType<typeof vi.fn>
  includeContainers: () => boolean
  setIncludeContainers: ReturnType<typeof vi.fn>
  includeAlerts: () => boolean
  setIncludeAlerts: ReturnType<typeof vi.fn>
  includeTimelineSummary: () => boolean
  setIncludeTimelineSummary: ReturnType<typeof vi.fn>
  includeExecutiveSummary: () => boolean
  setIncludeExecutiveSummary: ReturnType<typeof vi.fn>
  exportError: () => string | null
  isExporting: () => boolean
  submitExport: ReturnType<typeof vi.fn>
  isImportDialogOpen: () => boolean
  openImportDialog: ReturnType<typeof vi.fn>
  closeImportDialog: ReturnType<typeof vi.fn>
  handleBundleFileChange: ReturnType<typeof vi.fn>
  runDryRun: ReturnType<typeof vi.fn>
  executeImport: ReturnType<typeof vi.fn>
  canRunDryRun: () => boolean
  canExecuteImport: () => boolean
  validation: () => ImportValidationState | null
  isValidating: () => boolean
  isImporting: () => boolean
  importError: () => string | null
  importSuccess: () => string | null
  showCopyTrello: () => boolean
  showImport: () => boolean
  copyTrello: ReturnType<typeof vi.fn>
}

const controllerState = vi.hoisted<ExportImportControllerStub>(() => ({
  isExportDialogOpen: () => false,
  openExportDialog: vi.fn(),
  closeExportDialog: vi.fn(),
  exportType: () => 'portable',
  setExportTypeFromInput: vi.fn(),
  portableFormat: () => 'json',
  setPortableFormatFromInput: vi.fn(),
  reportFormat: () => 'json',
  setReportFormatFromInput: vi.fn(),
  includeContainers: () => true,
  setIncludeContainers: vi.fn(),
  includeAlerts: () => true,
  setIncludeAlerts: vi.fn(),
  includeTimelineSummary: () => true,
  setIncludeTimelineSummary: vi.fn(),
  includeExecutiveSummary: () => true,
  setIncludeExecutiveSummary: vi.fn(),
  exportError: () => null,
  isExporting: () => false,
  submitExport: vi.fn(),
  isImportDialogOpen: () => false,
  openImportDialog: vi.fn(),
  closeImportDialog: vi.fn(),
  handleBundleFileChange: vi.fn(),
  runDryRun: vi.fn(),
  executeImport: vi.fn(),
  canRunDryRun: () => false,
  canExecuteImport: () => false,
  validation: () => null,
  isValidating: () => false,
  isImporting: () => false,
  importError: () => null,
  importSuccess: () => null,
  showCopyTrello: () => false,
  showImport: () => false,
  copyTrello: vi.fn(),
}))

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    t: (value: string) => value,
    keys: translationKeys,
  }),
}))

vi.mock('~/shared/ui/Dialog', () => ({
  Dialog: (props: {
    readonly open: boolean
    readonly title: string
    readonly description: string
    readonly children: import('solid-js').JSX.Element
  }) => (
    <section data-open={String(props.open)} data-title={props.title}>
      <h2>{props.title}</h2>
      <p>{props.description}</p>
      {props.children}
    </section>
  ),
}))

vi.mock('~/modules/process/ui/components/export-import/useExportImportActionsController', () => ({
  useExportImportActionsController: () => controllerState,
}))

import { ExportImportActions } from '~/modules/process/ui/components/export-import/ExportImportActions'

describe('ExportImportActions view', () => {
  beforeEach(() => {
    controllerState.isExportDialogOpen = () => false
    controllerState.exportType = () => 'portable'
    controllerState.portableFormat = () => 'json'
    controllerState.reportFormat = () => 'json'
    controllerState.includeContainers = () => true
    controllerState.includeAlerts = () => true
    controllerState.includeTimelineSummary = () => true
    controllerState.includeExecutiveSummary = () => true
    controllerState.exportError = () => null
    controllerState.isExporting = () => false
    controllerState.isImportDialogOpen = () => false
    controllerState.canRunDryRun = () => false
    controllerState.canExecuteImport = () => false
    controllerState.validation = () => null
    controllerState.isValidating = () => false
    controllerState.isImporting = () => false
    controllerState.importError = () => null
    controllerState.importSuccess = () => null
    controllerState.showCopyTrello = () => false
    controllerState.showImport = () => false
  })

  it('renders the menu with export only and portable export controls by default', () => {
    const html = renderToString(() =>
      createComponent(ExportImportActions, {
        processId: null,
        showImport: false,
      }),
    )

    expect(html).toContain('More actions')
    expect(html).toContain('Export bundle')
    expect(html).not.toContain('Copy Trello')
    expect(html).not.toContain('Import bundle')
    expect(html).toContain('Export dialog')
    expect(html).toContain('<option value="zip">ZIP</option>')
    expect(html).toContain('Import dialog')
  })

  it('renders report and import validation branches from controller state', () => {
    controllerState.isExportDialogOpen = () => true
    controllerState.exportType = () => 'report'
    controllerState.reportFormat = () => 'json'
    controllerState.exportError = () => 'Export failed'
    controllerState.isImportDialogOpen = () => true
    controllerState.canRunDryRun = () => true
    controllerState.canExecuteImport = () => false
    controllerState.validation = () => ({
      canImport: true,
      schemaVersion: '1.0.0',
      processCount: 1,
      containerCount: 2,
      documentCount: 3,
      databaseEmpty: false,
      errors: ['Missing attachment'],
      warnings: ['Carrier code not recognized'],
    })
    controllerState.importError = () => 'Import validation failed'
    controllerState.importSuccess = () => 'Imported 1 processes and 2 containers'
    controllerState.showCopyTrello = () => true

    const html = renderToString(() =>
      createComponent(ExportImportActions, {
        processId: 'process-1',
        showImport: true,
      }),
    )

    expect(html).toContain('Copy Trello')
    expect(html).toContain('Include containers')
    expect(html).toContain('Include alerts')
    expect(html).toContain('Export failed')
    expect(html).toContain('Database not empty')
    expect(html).toContain('Missing attachment')
    expect(html).toContain('Carrier code not recognized')
    expect(html).toContain('Import validation failed')
    expect(html).toContain('Imported 1 processes and 2 containers')
  })
})
