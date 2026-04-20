import type { ProviderInput, ProviderRunResult } from '@agent/core/contracts/provider.contract'
import {
  classifyProviderException,
  isProviderBlockedMessage,
  PROVIDER_ERROR_CODES,
} from '@agent/providers/common/provider-error'
import {
  buildProviderFailure,
  buildProviderSuccess,
  type ProviderRunner,
} from '@agent/providers/common/provider-result'
import {
  createMaerskCaptureService,
  type MaerskCaptureService,
} from '~/modules/tracking/infrastructure/carriers/fetchers/maersk.puppeteer.fetcher'

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function buildBlockedOrRetryableFailure(command: {
  readonly startedAtMs: number
  readonly message: string
  readonly diagnostics?: Record<string, unknown>
}): ProviderRunResult {
  if (isProviderBlockedMessage(command.message)) {
    return buildProviderFailure({
      startedAtMs: command.startedAtMs,
      status: 'blocked',
      errorCode: PROVIDER_ERROR_CODES.blocked,
      errorMessage: command.message,
      diagnostics: command.diagnostics,
    })
  }

  const classification = classifyProviderException(command.message)
  return buildProviderFailure({
    startedAtMs: command.startedAtMs,
    status: classification.status,
    errorCode: classification.code,
    errorMessage: classification.message,
    diagnostics: command.diagnostics,
  })
}

export function createMaerskRunner(deps?: {
  readonly captureService?: MaerskCaptureService
}): ProviderRunner {
  const captureService = deps?.captureService ?? createMaerskCaptureService()

  return {
    provider: 'maersk',
    async run(input: ProviderInput): Promise<ProviderRunResult> {
      const startedAtMs = Date.now()

      if (input.hints.maerskEnabled !== true) {
        return buildProviderFailure({
          startedAtMs,
          status: 'terminal_failure',
          errorCode: PROVIDER_ERROR_CODES.execution,
          errorMessage: 'maersk target received but MAERSK_ENABLED is disabled',
          diagnostics: {
            provider: input.provider,
          },
        })
      }

      try {
        const result = await captureService.capture({
          container: input.ref,
          headless: input.hints.maerskHeadless ?? true,
          hold: false,
          timeoutMs: input.hints.maerskTimeoutMs ?? input.hints.timeoutMs ?? 120_000,
          userDataDir: input.hints.maerskUserDataDir,
        })

        if (result.kind === 'error') {
          let bodyMessage = JSON.stringify(result.body)
          if (typeof result.body.error === 'string') {
            bodyMessage = result.body.error
          } else if (typeof result.body.details === 'string') {
            bodyMessage = result.body.details
          }

          return buildBlockedOrRetryableFailure({
            startedAtMs,
            message: bodyMessage,
            diagnostics: {
              provider: input.provider,
              status: result.status,
              ...result.body,
            },
          })
        }

        return buildProviderSuccess({
          startedAtMs,
          observedAt: new Date().toISOString(),
          raw: result.payload,
          diagnostics: {
            provider: input.provider,
            status: result.status,
          },
        })
      } catch (error) {
        return buildBlockedOrRetryableFailure({
          startedAtMs,
          message: toErrorMessage(error),
          diagnostics: {
            provider: input.provider,
          },
        })
      }
    },
  }
}
