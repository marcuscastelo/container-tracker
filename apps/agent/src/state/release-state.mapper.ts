import { type ReleaseState, ReleaseStateSchema } from '@agent/core/contracts/release-state.contract'
import { BoundaryValidationError } from '@agent/core/errors/boundary-validation.error'

export function toReleaseState(raw: unknown): ReleaseState {
  const parsed = ReleaseStateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new BoundaryValidationError('Invalid release state payload', parsed.error.message)
  }

  return parsed.data
}

export function serializeReleaseState(state: ReleaseState): string {
  const normalized = ReleaseStateSchema.parse(state)
  return `${JSON.stringify(normalized, null, 2)}\n`
}
