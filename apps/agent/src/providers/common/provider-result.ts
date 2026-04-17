import {
  type ProviderInput,
  type ProviderRunResult,
  ProviderRunResultSchema,
  type ProviderRunStatus,
} from '@agent/core/contracts/provider.contract'

function nowIso(): string {
  return new Date().toISOString()
}

function buildTiming(startedAtMs: number): ProviderRunResult['timing'] {
  const finishedAtMs = Date.now()
  return {
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: Math.max(0, finishedAtMs - startedAtMs),
  }
}

export function buildProviderSuccess(command: {
  readonly startedAtMs: number
  readonly observedAt: string
  readonly raw: unknown
  readonly diagnostics?: Record<string, unknown>
}): ProviderRunResult {
  return ProviderRunResultSchema.parse({
    status: 'success',
    observedAt: command.observedAt,
    raw: command.raw,
    parseError: null,
    errorCode: null,
    errorMessage: null,
    diagnostics: command.diagnostics ?? {},
    timing: buildTiming(command.startedAtMs),
  })
}

export function buildProviderFailure(command: {
  readonly startedAtMs: number
  readonly status: Exclude<ProviderRunStatus, 'success'>
  readonly errorCode: string
  readonly errorMessage: string
  readonly raw?: unknown
  readonly parseError?: string | null
  readonly observedAt?: string
  readonly diagnostics?: Record<string, unknown>
}): ProviderRunResult {
  return ProviderRunResultSchema.parse({
    status: command.status,
    observedAt: command.observedAt ?? nowIso(),
    raw: command.raw ?? null,
    parseError: command.parseError ?? null,
    errorCode: command.errorCode,
    errorMessage: command.errorMessage,
    diagnostics: command.diagnostics ?? {},
    timing: buildTiming(command.startedAtMs),
  })
}

export type ProviderRunner = {
  readonly provider: ProviderInput['provider']
  run(input: ProviderInput): Promise<ProviderRunResult>
}
