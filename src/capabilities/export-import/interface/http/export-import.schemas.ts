import { z } from 'zod'

const ScopeSchema = z.enum(['all_processes', 'single_process'])

function requireProcessIdForSingleProcessScope(
  data: {
    readonly scope: 'all_processes' | 'single_process'
    readonly processId?: string | null | undefined
  },
  ctx: z.RefinementCtx,
): void {
  if (data.scope !== 'single_process') return

  if (typeof data.processId !== 'string' || data.processId.trim().length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processId'],
      message: 'processId is required when scope is single_process',
    })
  }
}

export const SymmetricExportRequestSchema = z
  .object({
    scope: ScopeSchema,
    processId: z.string().nullish(),
    format: z.enum(['json', 'zip']),
  })
  .superRefine(requireProcessIdForSingleProcessScope)

const SymmetricContainerEntrySchema = z.object({
  importKey: z.string(),
  processImportKey: z.string(),
  containerNumber: z.string(),
  carrierCode: z.string().nullable(),
})

const SymmetricProcessEntrySchema = z.object({
  importKey: z.string(),
  reference: z.string().nullable(),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  depositary: z.string().nullable(),
  carrier: z.string().nullable(),
  billOfLading: z.string().nullable(),
  bookingNumber: z.string().nullable(),
  importerName: z.string().nullable(),
  exporterName: z.string().nullable(),
  referenceImporter: z.string().nullable(),
  product: z.string().nullable(),
  redestinationNumber: z.string().nullable(),
  source: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  containers: z.array(SymmetricContainerEntrySchema),
})

const SymmetricDocumentEntrySchema = z.object({
  importKey: z.string(),
  processImportKey: z.string(),
  containerImportKey: z.string().nullable(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().nullable(),
  storageKey: z.string(),
})

const SymmetricBundleSchema = z.object({
  schemaVersion: z.literal('1.0'),
  exportType: z.literal('PORTABLE_SYMMETRIC'),
  exportedAt: z.string(),
  metadata: z.object({
    tenant: z.string().nullable(),
    processCount: z.number().int().nonnegative(),
    containerCount: z.number().int().nonnegative(),
    documentCount: z.number().int().nonnegative(),
  }),
  manifest: z.object({
    schemaVersion: z.literal('1.0'),
    exportType: z.literal('PORTABLE_SYMMETRIC'),
    exportedAt: z.string(),
    processCount: z.number().int().nonnegative(),
    containerCount: z.number().int().nonnegative(),
    documentCount: z.number().int().nonnegative(),
  }),
  processes: z.array(SymmetricProcessEntrySchema),
  documents: z.array(SymmetricDocumentEntrySchema),
})

export const ValidateSymmetricImportRequestSchema = z.object({
  bundle: SymmetricBundleSchema,
})

export const ExecuteSymmetricImportRequestSchema = z.object({
  bundle: SymmetricBundleSchema,
})

export const SymmetricImportValidationResponseSchema = z.object({
  canImport: z.boolean(),
  schemaVersion: z.string().nullable(),
  processCount: z.number().int().nonnegative(),
  containerCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  databaseEmpty: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
})

export const ExecuteSymmetricImportResponseSchema = z.object({
  importedProcesses: z.number().int().nonnegative(),
  importedContainers: z.number().int().nonnegative(),
  importedDocuments: z.number().int().nonnegative(),
})

export const ReportExportRequestSchema = z
  .object({
    scope: ScopeSchema,
    processId: z.string().nullish(),
    format: z.enum(['json', 'csv', 'xlsx', 'markdown', 'pdf', 'trello']),
    includeContainers: z.boolean().optional(),
    includeAlerts: z.boolean().optional(),
    includeTimelineSummary: z.boolean().optional(),
    includeExecutiveSummary: z.boolean().optional(),
  })
  .superRefine(requireProcessIdForSingleProcessScope)
