import { describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => ({
  exportSymmetric: vi.fn(),
  validateSymmetricImport: vi.fn(),
  executeSymmetricImport: vi.fn(),
  exportReport: vi.fn(),
}))

vi.mock('~/shared/api/export-import.controllers.bootstrap', () => ({
  exportImportControllers: {
    exportSymmetric: handlers.exportSymmetric,
    validateSymmetricImport: handlers.validateSymmetricImport,
    executeSymmetricImport: handlers.executeSymmetricImport,
    exportReport: handlers.exportReport,
  },
}))

import {
  POST as exportReportPost,
  runtime as reportExportRuntime,
} from '~/routes/api/export-import/report/export'
import {
  POST as exportSymmetricPost,
  runtime as symmetricExportRuntime,
} from '~/routes/api/export-import/symmetric/export'
import {
  POST as executeSymmetricImportPost,
  runtime as symmetricImportExecuteRuntime,
} from '~/routes/api/export-import/symmetric/import/execute'
import {
  runtime as symmetricImportValidateRuntime,
  POST as validateSymmetricImportPost,
} from '~/routes/api/export-import/symmetric/import/validate'

describe('export/import API route bindings', () => {
  it('binds symmetric export route to capability controller', () => {
    expect(exportSymmetricPost).toBe(handlers.exportSymmetric)
    expect(symmetricExportRuntime).toBe('nodejs')
  })

  it('binds import validate route to capability controller', () => {
    expect(validateSymmetricImportPost).toBe(handlers.validateSymmetricImport)
    expect(symmetricImportValidateRuntime).toBe('nodejs')
  })

  it('binds import execute route to capability controller', () => {
    expect(executeSymmetricImportPost).toBe(handlers.executeSymmetricImport)
    expect(symmetricImportExecuteRuntime).toBe('nodejs')
  })

  it('binds report export route to capability controller', () => {
    expect(exportReportPost).toBe(handlers.exportReport)
    expect(reportExportRuntime).toBe('nodejs')
  })
})
