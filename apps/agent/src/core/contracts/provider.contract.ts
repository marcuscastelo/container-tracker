import { AgentProviderSchema } from '@agent/core/types/provider'
import { z } from 'zod/v4'

const ProviderExecutionHintsSchema = z
  .object({
    timeoutMs: z.number().int().positive().nullable(),
    maerskEnabled: z.boolean().nullable(),
    maerskHeadless: z.boolean().nullable(),
    maerskTimeoutMs: z.number().int().positive().nullable(),
    maerskUserDataDir: z.string().min(1).nullable(),
  })
  .strict()

const ProviderCorrelationSchema = z
  .object({
    tenantId: z.string().uuid(),
    agentId: z.string().min(1),
    agentVersion: z.string().min(1),
  })
  .strict()

export const ProviderInputSchema = z
  .object({
    syncRequestId: z.string().uuid(),
    provider: AgentProviderSchema,
    refType: z.literal('container'),
    ref: z.string().min(1),
    hints: ProviderExecutionHintsSchema,
    correlation: ProviderCorrelationSchema,
  })
  .strict()

export type ProviderInput = z.infer<typeof ProviderInputSchema>

const ProviderRunStatusSchema = z.enum([
  'success',
  'retryable_failure',
  'terminal_failure',
  'blocked',
])

const ProviderRunTimingSchema = z
  .object({
    startedAt: z.string().datetime({ offset: true }),
    finishedAt: z.string().datetime({ offset: true }),
    durationMs: z.number().int().min(0),
  })
  .strict()

export const ProviderRunResultSchema = z
  .object({
    status: ProviderRunStatusSchema,
    observedAt: z.string().datetime({ offset: true }),
    raw: z.unknown().nullable(),
    parseError: z.string().min(1).nullable(),
    errorCode: z.string().min(1).nullable(),
    errorMessage: z.string().min(1).nullable(),
    diagnostics: z.record(z.string(), z.unknown()).default({}),
    timing: ProviderRunTimingSchema,
  })
  .superRefine((value, context) => {
    if (value.status === 'success') {
      if (value.raw === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['raw'],
          message: 'success result requires raw payload',
        })
      }

      if (value.errorCode !== null || value.errorMessage !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['errorMessage'],
          message: 'success result must not contain error fields',
        })
      }
    }

    if (value.status !== 'success' && value.errorMessage === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['errorMessage'],
        message: 'non-success result requires errorMessage',
      })
    }

    if (value.status !== 'success' && value.errorCode === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['errorCode'],
        message: 'non-success result requires errorCode',
      })
    }
  })

export type ProviderRunResult = z.infer<typeof ProviderRunResultSchema>

export type ProviderRunStatus = z.infer<typeof ProviderRunStatusSchema>
