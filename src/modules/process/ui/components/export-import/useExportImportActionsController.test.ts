import { createRoot } from 'solid-js'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportValidationState } from '~/modules/process/ui/components/export-import/useExportImportActionsController'

const requestPortableExportMock = vi.hoisted(() => vi.fn(async () => undefined))
const requestOperationalReportExportMock = vi.hoisted(() => vi.fn(async () => undefined))
const requestOperationalReportExportTextMock = vi.hoisted(() => vi.fn(async () => 'trello export'))
const validateSymmetricImportBundleMock = vi.hoisted(() => vi.fn())
const executeSymmetricImportBundleMock = vi.hoisted(() =>
  vi.fn(async () => ({
    importedProcesses: 2,
    importedContainers: 3,
  })),
)
const copyToClipboardMock = vi.hoisted(() => vi.fn(async () => true))
const toastErrorMock = vi.hoisted(() => vi.fn())

const translationKeys = vi.hoisted(() => ({
  exportImport: {
    copyTrelloError: 'Failed to copy Trello export',
    importDialog: {
      invalidBundleJson: 'Invalid bundle JSON',
      importSuccess: 'Imported {processes} processes and {containers} containers',
    },
  },
}))

vi.mock('solid-js', async () => vi.importActual('solid-js/dist/solid.js'))

vi.mock('~/modules/process/ui/api/export-import.api', () => ({
  requestPortableExport: requestPortableExportMock,
  requestOperationalReportExport: requestOperationalReportExportMock,
  requestOperationalReportExportText: requestOperationalReportExportTextMock,
  validateSymmetricImportBundle: validateSymmetricImportBundleMock,
  executeSymmetricImportBundle: executeSymmetricImportBundleMock,
}))

vi.mock('~/shared/utils/clipboard', () => ({
  copyToClipboard: copyToClipboardMock,
}))

vi.mock('solid-toast', () => ({
  default: {
    error: toastErrorMock,
  },
}))

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    t: (value: string, params?: Record<string, string | number>) => {
      if (!params) return value
      return Object.entries(params).reduce(
        (message, [key, current]) => message.replace(`{${key}}`, String(current)),
        value,
      )
    },
    keys: translationKeys,
  }),
}))

import { useExportImportActionsController } from '~/modules/process/ui/components/export-import/useExportImportActionsController'

type ControllerHarness = ReturnType<typeof useExportImportActionsController> & {
  readonly dispose: () => void
}

type OriginalHtmlInputElement = typeof globalThis.HTMLInputElement | undefined
type OriginalWindow = typeof globalThis.window | undefined

class FakeHtmlInputElement {
  files: readonly File[] | null = null
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function buildImportValidation(overrides?: Partial<ImportValidationState>): ImportValidationState {
  return {
    canImport: true,
    schemaVersion: '1.0.0',
    processCount: 1,
    containerCount: 1,
    documentCount: 0,
    databaseEmpty: true,
    errors: [],
    warnings: [],
    ...overrides,
  }
}

function mountController(processId: string | null, showImport = true): ControllerHarness {
  return createRoot((dispose) => {
    const controller = useExportImportActionsController({
      processId,
      showImport,
    })

    return {
      ...controller,
      dispose,
    }
  })
}

function createFileChangeEvent(file: File | null): Event {
  const input = new FakeHtmlInputElement()
  input.files = file ? [file] : null
  const event = new Event('change')
  Object.defineProperty(event, 'currentTarget', {
    configurable: true,
    value: input,
  })
  return event
}

describe('useExportImportActionsController', () => {
  let originalHtmlInputElement: OriginalHtmlInputElement
  let originalWindow: OriginalWindow

  beforeAll(() => {
    originalHtmlInputElement = globalThis.HTMLInputElement
    Object.defineProperty(globalThis, 'HTMLInputElement', {
      configurable: true,
      value: FakeHtmlInputElement,
    })
  })

  afterAll(() => {
    if (originalHtmlInputElement === undefined) {
      Reflect.deleteProperty(globalThis, 'HTMLInputElement')
    } else {
      Object.defineProperty(globalThis, 'HTMLInputElement', {
        configurable: true,
        value: originalHtmlInputElement,
      })
    }
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window')
      return
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  })

  beforeEach(() => {
    originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    })
    requestPortableExportMock.mockReset()
    requestOperationalReportExportMock.mockReset()
    requestOperationalReportExportTextMock.mockReset()
    validateSymmetricImportBundleMock.mockReset()
    executeSymmetricImportBundleMock.mockReset()
    copyToClipboardMock.mockReset()
    toastErrorMock.mockReset()

    requestPortableExportMock.mockResolvedValue(undefined)
    requestOperationalReportExportMock.mockResolvedValue(undefined)
    requestOperationalReportExportTextMock.mockResolvedValue('trello export')
    validateSymmetricImportBundleMock.mockImplementation(async () => buildImportValidation())
    executeSymmetricImportBundleMock.mockResolvedValue({
      importedProcesses: 2,
      importedContainers: 3,
    })
    copyToClipboardMock.mockResolvedValue(true)
  })

  it('skips Trello copy when no process is selected', async () => {
    const controller = mountController(null)

    await controller.copyTrello()

    expect(requestOperationalReportExportTextMock).not.toHaveBeenCalled()
    expect(copyToClipboardMock).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('copies Trello text with inline feedback and keeps toast only for failures', async () => {
    vi.useFakeTimers()
    const controller = mountController('process-1')

    await controller.copyTrello()

    expect(requestOperationalReportExportTextMock).toHaveBeenCalledWith({
      scope: {
        scope: 'single_process',
        processId: 'process-1',
      },
      format: 'trello',
      options: {
        includeContainers: true,
        includeAlerts: true,
        includeTimelineSummary: true,
        includeExecutiveSummary: true,
      },
    })
    expect(copyToClipboardMock).toHaveBeenCalledWith('trello export')
    expect(controller.copyTrelloFeedback()).toBe(true)

    copyToClipboardMock.mockResolvedValueOnce(false)
    await controller.copyTrello()

    expect(toastErrorMock).toHaveBeenCalledWith('Failed to copy Trello export')
    vi.advanceTimersByTime(1_200)
    expect(controller.copyTrelloFeedback()).toBe(false)
    controller.dispose()
  })

  it('exports portable bundles with all-process scope by default', async () => {
    const controller = mountController(null)

    await controller.submitExport()

    expect(requestPortableExportMock).toHaveBeenCalledWith({
      scope: {
        scope: 'all_processes',
        processId: null,
      },
      format: 'json',
    })
    expect(controller.isExportDialogOpen()).toBe(false)
    controller.dispose()
  })

  it('forces Trello report exports to include all report sections', async () => {
    const controller = mountController('process-9')

    controller.setExportTypeFromInput('report')
    controller.setIncludeContainers(false)
    controller.setIncludeAlerts(false)
    controller.setIncludeTimelineSummary(false)
    controller.setIncludeExecutiveSummary(false)
    controller.setReportFormatFromInput('trello')
    await controller.submitExport()

    expect(requestOperationalReportExportMock).toHaveBeenCalledWith({
      scope: {
        scope: 'single_process',
        processId: 'process-9',
      },
      format: 'trello',
      options: {
        includeContainers: true,
        includeAlerts: true,
        includeTimelineSummary: true,
        includeExecutiveSummary: true,
      },
    })
    controller.dispose()
  })

  it('surfaces invalid bundle JSON and keeps import blocked', async () => {
    const controller = mountController(null)

    await controller.handleBundleFileChange(
      createFileChangeEvent(new File(['not-json'], 'broken.json', { type: 'application/json' })),
    )

    expect(controller.importError()).toBe('Invalid bundle JSON')
    expect(controller.canRunDryRun()).toBe(false)
    controller.runDryRun()
    await flushMicrotasks()
    expect(validateSymmetricImportBundleMock).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('validates and executes import when the bundle is accepted', async () => {
    const controller = mountController(null)
    const bundle = {
      processes: [{ id: 'process-1' }],
    }

    await controller.handleBundleFileChange(
      createFileChangeEvent(
        new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' }),
      ),
    )
    await flushMicrotasks()

    await controller.runDryRun()

    expect(validateSymmetricImportBundleMock).toHaveBeenCalledWith({ bundle })
    expect(controller.validation()).not.toBeNull()
    expect(controller.canExecuteImport()).toBe(true)

    await controller.executeImport()

    expect(executeSymmetricImportBundleMock).toHaveBeenCalledWith({ bundle })
    expect(controller.importSuccess()).toBe('Imported 2 processes and 3 containers')
    controller.dispose()
  })

  it('blocks import execution when validation says the database is not empty', async () => {
    validateSymmetricImportBundleMock.mockImplementationOnce(async () =>
      buildImportValidation({
        databaseEmpty: false,
      }),
    )

    const controller = mountController(null)
    const bundle = {
      processes: [{ id: 'process-1' }],
    }

    await controller.handleBundleFileChange(
      createFileChangeEvent(
        new File([JSON.stringify(bundle)], 'bundle.json', { type: 'application/json' }),
      ),
    )
    await flushMicrotasks()

    await controller.runDryRun()
    await controller.executeImport()

    expect(controller.canExecuteImport()).toBe(false)
    expect(executeSymmetricImportBundleMock).not.toHaveBeenCalled()
    controller.dispose()
  })
})
