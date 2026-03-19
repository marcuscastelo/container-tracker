import { typedFetch } from '~/shared/api/typedFetch'
import {
  ExecuteSymmetricImportResponseSchema,
  SymmetricImportValidationResponseSchema,
} from '~/shared/api-schemas/export-import.schemas'

export type ExportType = 'portable' | 'report'
export type PortableFormat = 'json' | 'zip'
export type ReportFormat = 'json' | 'csv' | 'xlsx' | 'markdown' | 'pdf' | 'trello'

export type ExportScope =
  | {
      readonly scope: 'all_processes'
      readonly processId: null
    }
  | {
      readonly scope: 'single_process'
      readonly processId: string
    }

export type ReportExportOptions = {
  readonly includeContainers: boolean
  readonly includeAlerts: boolean
  readonly includeTimelineSummary: boolean
  readonly includeExecutiveSummary: boolean
}

function resolveFilenameFromContentDisposition(
  contentDisposition: string | null,
  fallbackFilename: string,
): string {
  if (!contentDisposition) return fallbackFilename

  const match = /filename="([^"]+)"/.exec(contentDisposition)
  if (!match) return fallbackFilename

  const filename = match[1]
  if (!filename || filename.trim().length === 0) return fallbackFilename

  return filename
}

function parseErrorPayload(payload: unknown): { readonly error?: string } | null {
  if (typeof payload !== 'object' || payload === null) return null
  const errorValue = Reflect.get(payload, 'error')
  if (typeof errorValue !== 'string') return null
  return { error: errorValue }
}

function resolveHttpErrorFallback(status: number): string {
  if (status === 404) return 'Export endpoint not found.'
  if (status === 503) return 'Export service is temporarily unavailable.'
  if (status >= 500) return 'Export failed due to a server error.'
  return 'Export failed.'
}

function downloadBlob(command: { readonly blob: Blob; readonly filename: string }): void {
  const objectUrl = URL.createObjectURL(command.blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = command.filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

async function requestDownload(command: {
  readonly endpoint: string
  readonly payload: Record<string, unknown>
  readonly fallbackFilename: string
}): Promise<void> {
  const response = await fetch(command.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command.payload),
  })

  if (!response.ok) {
    const payload = parseErrorPayload(await response.json().catch(() => null))
    throw new Error(payload?.error ?? resolveHttpErrorFallback(response.status))
  }

  const blob = await response.blob()
  const filename = resolveFilenameFromContentDisposition(
    response.headers.get('Content-Disposition'),
    command.fallbackFilename,
  )

  downloadBlob({ blob, filename })
}

async function requestTextExport(command: {
  readonly endpoint: string
  readonly payload: Record<string, unknown>
}): Promise<string> {
  const response = await fetch(command.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(command.payload),
  })

  if (!response.ok) {
    const payload = parseErrorPayload(await response.json().catch(() => null))
    throw new Error(payload?.error ?? resolveHttpErrorFallback(response.status))
  }

  return response.text()
}

export async function requestPortableExport(command: {
  readonly scope: ExportScope
  readonly format: PortableFormat
}): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  const fallbackFilename = `portable-export-${date}.${command.format}`

  await requestDownload({
    endpoint: '/api/export-import/symmetric/export',
    payload: {
      scope: command.scope.scope,
      processId: command.scope.processId,
      format: command.format,
    },
    fallbackFilename,
  })
}

export async function requestOperationalReportExport(command: {
  readonly scope: ExportScope
  readonly format: ReportFormat
  readonly options: ReportExportOptions
}): Promise<void> {
  const date = new Date().toISOString().slice(0, 10)
  let fallbackFilename = `processes-report-${date}.${command.format === 'markdown' ? 'md' : command.format}`

  if (command.format === 'trello') {
    fallbackFilename =
      command.scope.scope === 'all_processes'
        ? `trello-export-${date}.zip`
        : `snapshot-process-${date}.md`
  }

  await requestDownload({
    endpoint: '/api/export-import/report/export',
    payload: {
      scope: command.scope.scope,
      processId: command.scope.processId,
      format: command.format,
      includeContainers: command.options.includeContainers,
      includeAlerts: command.options.includeAlerts,
      includeTimelineSummary: command.options.includeTimelineSummary,
      includeExecutiveSummary: command.options.includeExecutiveSummary,
    },
    fallbackFilename,
  })
}

export async function requestOperationalReportExportText(command: {
  readonly scope: ExportScope
  readonly format: Extract<ReportFormat, 'trello'>
  readonly options: ReportExportOptions
}): Promise<string> {
  return requestTextExport({
    endpoint: '/api/export-import/report/export',
    payload: {
      scope: command.scope.scope,
      processId: command.scope.processId,
      format: command.format,
      includeContainers: command.options.includeContainers,
      includeAlerts: command.options.includeAlerts,
      includeTimelineSummary: command.options.includeTimelineSummary,
      includeExecutiveSummary: command.options.includeExecutiveSummary,
    },
  })
}

export async function validateSymmetricImportBundle(command: { readonly bundle: unknown }) {
  return typedFetch(
    '/api/export-import/symmetric/import/validate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundle: command.bundle }),
    },
    SymmetricImportValidationResponseSchema,
  )
}

export async function executeSymmetricImportBundle(command: { readonly bundle: unknown }) {
  return typedFetch(
    '/api/export-import/symmetric/import/execute',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundle: command.bundle }),
    },
    ExecuteSymmetricImportResponseSchema,
  )
}
