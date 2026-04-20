import type { ProviderInput, ProviderRunResult } from '@agent/core/contracts/provider.contract'
import {
  classifyProviderException,
  classifyProviderParseError,
} from '@agent/providers/common/provider-error'
import {
  buildProviderFailure,
  buildProviderSuccess,
  type ProviderRunner,
} from '@agent/providers/common/provider-result'
import { fetchOneStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/one.fetcher'

type OneFetcher = (containerNumber: string) => Promise<{
  readonly payload: unknown
  readonly fetchedAt: string
  readonly parseError?: string | null
}>

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function createOneRunner(deps?: { readonly fetchStatus?: OneFetcher }): ProviderRunner {
  const fetchStatus = deps?.fetchStatus ?? fetchOneStatus

  return {
    provider: 'one',
    async run(input: ProviderInput): Promise<ProviderRunResult> {
      const startedAtMs = Date.now()

      try {
        const result = await fetchStatus(input.ref)

        if (result.parseError) {
          const classification = classifyProviderParseError(result.parseError)
          return buildProviderFailure({
            startedAtMs,
            status: classification.status,
            errorCode: classification.code,
            errorMessage: classification.message,
            parseError: result.parseError,
            raw: result.payload,
            observedAt: result.fetchedAt,
            diagnostics: {
              provider: input.provider,
            },
          })
        }

        return buildProviderSuccess({
          startedAtMs,
          observedAt: result.fetchedAt,
          raw: result.payload,
          diagnostics: {
            provider: input.provider,
          },
        })
      } catch (error) {
        const message = toErrorMessage(error)
        const classification = classifyProviderException(message)
        return buildProviderFailure({
          startedAtMs,
          status: classification.status,
          errorCode: classification.code,
          errorMessage: classification.message,
          diagnostics: {
            provider: input.provider,
          },
        })
      }
    },
  }
}
