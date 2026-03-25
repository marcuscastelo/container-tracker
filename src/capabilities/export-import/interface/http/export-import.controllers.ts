import {
  IMPORT_REQUIRES_EMPTY_DATABASE,
  ImportRequiresEmptyDatabaseError,
} from '~/capabilities/export-import/application/export-import.errors'
import type { ExportImportUseCases } from '~/capabilities/export-import/application/export-import.usecases'
import { serializeReportExport } from '~/capabilities/export-import/infrastructure/serializers/report.serializer'
import { serializeSymmetricExport } from '~/capabilities/export-import/infrastructure/serializers/symmetric.serializer'
import {
  ExecuteSymmetricImportRequestSchema,
  ExecuteSymmetricImportResponseSchema,
  ReportExportRequestSchema,
  SymmetricExportRequestSchema,
  SymmetricImportValidationResponseSchema,
  ValidateSymmetricImportRequestSchema,
} from '~/capabilities/export-import/interface/http/export-import.schemas'
import { mapErrorToResponse } from '~/shared/api/errorToResponse'
import { jsonResponse } from '~/shared/api/typedRoute'

type ExportImportControllersDeps = {
  readonly exportImportUseCases: ExportImportUseCases
}

function toFileResponse(command: {
  readonly filename: string
  readonly contentType: string
  readonly content: Uint8Array
}): Response {
  return new Response(Buffer.from(command.content), {
    status: 200,
    headers: {
      'Content-Type': command.contentType,
      'Content-Disposition': `attachment; filename="${command.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function createExportImportControllers(deps: ExportImportControllersDeps) {
  async function exportSymmetric({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const payload = SymmetricExportRequestSchema.parse(await request.json())
      const bundle = await deps.exportImportUseCases.exportSymmetric({
        scope: payload.scope,
        processId: payload.processId ?? null,
      })

      const serialized = await serializeSymmetricExport({
        bundle,
        format: payload.format,
      })

      return toFileResponse(serialized)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function validateSymmetricImport({
    request,
  }: {
    readonly request: Request
  }): Promise<Response> {
    try {
      const payload = ValidateSymmetricImportRequestSchema.parse(await request.json())
      const result = await deps.exportImportUseCases.validateSymmetricImport(payload.bundle)
      return jsonResponse(result, 200, SymmetricImportValidationResponseSchema)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  async function executeSymmetricImport({
    request,
  }: {
    readonly request: Request
  }): Promise<Response> {
    try {
      const payload = ExecuteSymmetricImportRequestSchema.parse(await request.json())
      const result = await deps.exportImportUseCases.executeSymmetricImport(payload.bundle)
      return jsonResponse(result, 200, ExecuteSymmetricImportResponseSchema)
    } catch (error) {
      if (error instanceof ImportRequiresEmptyDatabaseError) {
        return jsonResponse(
          {
            error: error.message,
            code: IMPORT_REQUIRES_EMPTY_DATABASE,
          },
          409,
        )
      }

      return mapErrorToResponse(error)
    }
  }

  async function exportReport({ request }: { readonly request: Request }): Promise<Response> {
    try {
      const payload = ReportExportRequestSchema.parse(await request.json())
      const report = await deps.exportImportUseCases.exportReport({
        scope: payload.scope,
        processId: payload.processId ?? null,
        includeContainers: payload.includeContainers ?? true,
        includeAlerts: payload.includeAlerts ?? true,
        includeTimelineSummary: payload.includeTimelineSummary ?? true,
        includeExecutiveSummary: payload.includeExecutiveSummary ?? true,
      })

      const serialized = await serializeReportExport({
        report,
        format: payload.format,
      })

      return toFileResponse(serialized)
    } catch (error) {
      return mapErrorToResponse(error)
    }
  }

  return {
    exportSymmetric,
    validateSymmetricImport,
    executeSymmetricImport,
    exportReport,
  }
}
