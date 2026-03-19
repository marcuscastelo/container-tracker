import { describe, expect, it } from 'vitest'
import {
  ReportExportRequestSchema,
  SymmetricExportRequestSchema,
} from '~/capabilities/export-import/interface/http/export-import.schemas'

function expectProcessIdIssue(result: {
  readonly success: boolean
  readonly error?: {
    readonly issues: readonly {
      readonly path: readonly PropertyKey[]
    }[]
  }
}): void {
  if (result.success) {
    throw new Error('Expected schema validation to fail')
  }

  const error = result.error
  if (!error) {
    throw new Error('Expected schema validation error details')
  }

  expect(error.issues.some((issue) => issue.path.join('.') === 'processId')).toBe(true)
}

describe('export-import request schemas', () => {
  it('requires processId for symmetric export when scope is single_process', () => {
    const result = SymmetricExportRequestSchema.safeParse({
      scope: 'single_process',
      format: 'json',
    })

    expectProcessIdIssue(result)
  })

  it('requires processId for report export when scope is single_process', () => {
    const result = ReportExportRequestSchema.safeParse({
      scope: 'single_process',
      format: 'json',
    })

    expectProcessIdIssue(result)
  })

  it('allows all_processes requests without processId', () => {
    expect(
      SymmetricExportRequestSchema.safeParse({
        scope: 'all_processes',
        format: 'json',
      }).success,
    ).toBe(true)

    expect(
      ReportExportRequestSchema.safeParse({
        scope: 'all_processes',
        format: 'json',
      }).success,
    ).toBe(true)
  })
})
