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
import { CmaCgmApiStrictSchema } from '~/modules/tracking/infrastructure/carriers/schemas/api/cmacgm.api.schema'

type CmaCgmFetcher = (containerNumber: string) => Promise<{
  readonly payload: unknown
  readonly fetchedAt: string
  readonly parseError?: string | null
}>

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hasNonEmptyText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function assessPayload(payload: unknown): {
  readonly parseError: string | null
  readonly warnings: readonly string[]
} {
  const strictParseResult = CmaCgmApiStrictSchema.safeParse(payload)
  if (!strictParseResult.success) {
    const firstIssue = strictParseResult.error.issues[0]
    if (firstIssue === undefined) {
      return {
        parseError: 'CMA-CGM payload does not match expected snapshot shape',
        warnings: [],
      }
    }

    const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : 'payload'
    return {
      parseError: `CMA-CGM payload invalid at ${path}: ${firstIssue.message}`,
      warnings: [],
    }
  }

  const allMoves = [
    ...(strictParseResult.data.PastMoves ?? []),
    ...(strictParseResult.data.CurrentMoves ?? []),
    ...(strictParseResult.data.ProvisionalMoves ?? []),
  ]

  const hasSemanticMove = allMoves.some(
    (move) =>
      hasNonEmptyText(move.StatusDescription) &&
      (hasNonEmptyText(move.Date) || hasNonEmptyText(move.DateString)),
  )

  if (!hasSemanticMove) {
    return {
      parseError: null,
      warnings: ['CMA-CGM payload accepted with low confidence: moves missing status/date'],
    }
  }

  return {
    parseError: null,
    warnings: [],
  }
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
        const payloadAssessment = assessPayload(result.payload)
        const parseError = result.parseError ?? payloadAssessment.parseError

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

        if (payloadAssessment.warnings.length > 0) {
          console.warn('[agent] provider payload warning', {
            provider: input.provider,
            ref: input.ref,
            warnings: payloadAssessment.warnings,
          })
        }

        return buildProviderSuccess({
          startedAtMs,
          observedAt: result.fetchedAt,
          raw: result.payload,
          diagnostics: {
            provider: input.provider,
            warnings: payloadAssessment.warnings,
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
