import { z } from 'zod'

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
