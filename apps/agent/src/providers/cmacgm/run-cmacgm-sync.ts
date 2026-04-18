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
import { fetchCmaCgmStatus } from '~/modules/tracking/infrastructure/carriers/fetchers/cmacgm.fetcher'
import { CmaCgmApiSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/cmacgm.api.schema'

type CmaCgmFetcher = (containerNumber: string) => Promise<{
  readonly payload: unknown
  readonly fetchedAt: string
  readonly parseError?: string | null
}>

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toPayloadShapeError(payload: unknown): string | null {
  const parseResult = CmaCgmApiSchema.safeParse(payload)
  if (parseResult.success) {
    return null
  }

  const firstIssue = parseResult.error.issues[0]
  if (firstIssue === undefined) {
    return 'CMA-CGM payload does not match expected snapshot shape'
  }

  const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'payload'
  return `CMA-CGM payload invalid at ${path}: ${firstIssue.message}`
}

export function createCmaCgmRunner(deps?: {
  readonly fetchStatus?: CmaCgmFetcher
}): ProviderRunner {
  const fetchStatus = deps?.fetchStatus ?? fetchCmaCgmStatus

  return {
    provider: 'cmacgm',
    async run(input: ProviderInput): Promise<ProviderRunResult> {
      const startedAtMs = Date.now()

      try {
        const result = await fetchStatus(input.ref)
        const payloadShapeError = toPayloadShapeError(result.payload)
        const parseError = result.parseError ?? payloadShapeError

        if (parseError !== null) {
          const classification = classifyProviderParseError(parseError)
          return buildProviderFailure({
            startedAtMs,
            status: classification.status,
            errorCode: classification.code,
            errorMessage: classification.message,
            parseError,
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
