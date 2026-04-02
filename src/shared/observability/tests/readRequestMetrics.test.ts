import { describe, expect, it, vi } from 'vitest'
import {
  measureAuditedReadQuery,
  runWithReadRequestAudit,
} from '~/shared/observability/readRequestMetrics'

function preserveEnvValue(key: 'NODE_ENV' | 'READ_AUDIT_ENABLED') {
  const previous = process.env[key]

  return () => {
    if (previous === undefined) {
      delete process.env[key]
      return
    }

    process.env[key] = previous
  }
}

describe('readRequestMetrics', () => {
  it('skips audit logging in production by default', async () => {
    const restoreNodeEnv = preserveEnvValue('NODE_ENV')
    const restoreAuditToggle = preserveEnvValue('READ_AUDIT_ENABLED')
    process.env.NODE_ENV = 'production'
    delete process.env.READ_AUDIT_ENABLED

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    try {
      const result = await runWithReadRequestAudit(
        {
          endpoint: '/api/test',
          projection: 'TestProjection',
          readStrategy: 'test.strategy',
          triggeredBy: 'unit-test',
        },
        async () =>
          measureAuditedReadQuery({
            table: 'big_table',
            operation: 'list',
            query: async () => ({ data: [{ id: 'row-1' }] }),
            resultSelector: () => {
              throw new Error('resultSelector should not run when auditing is disabled')
            },
          }),
      )

      expect(result).toEqual({ data: [{ id: 'row-1' }] })
      expect(consoleInfoSpy).not.toHaveBeenCalled()
    } finally {
      consoleInfoSpy.mockRestore()
      restoreAuditToggle()
      restoreNodeEnv()
    }
  })

  it('avoids stringifying large result sets when estimating read bytes', async () => {
    const restoreNodeEnv = preserveEnvValue('NODE_ENV')
    const restoreAuditToggle = preserveEnvValue('READ_AUDIT_ENABLED')
    process.env.NODE_ENV = 'test'
    delete process.env.READ_AUDIT_ENABLED

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    try {
      const largeRows = Array.from({ length: 64 }, (_, index) => ({
        index,
        toJSON() {
          throw new Error('large result should not be stringified')
        },
      }))

      const result = await runWithReadRequestAudit(
        {
          endpoint: '/api/test',
          projection: 'TestProjection',
          readStrategy: 'test.strategy',
          triggeredBy: 'unit-test',
        },
        async () =>
          measureAuditedReadQuery({
            table: 'big_table',
            operation: 'list',
            query: async () => ({ data: largeRows }),
            resultSelector: (queryResult) => queryResult.data ?? [],
          }),
      )

      expect(result.data).toHaveLength(64)
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1)
      expect(String(consoleInfoSpy.mock.calls[0]?.[1])).toContain('"estimated_db_read_bytes":null')
    } finally {
      consoleInfoSpy.mockRestore()
      restoreAuditToggle()
      restoreNodeEnv()
    }
  })
})
