import { type RuntimeState, RuntimeStateSchema } from '@agent/core/contracts/runtime-state.contract'
import { BoundaryValidationError } from '@agent/core/errors/boundary-validation.error'

export function toRuntimeState(raw: unknown): RuntimeState {
  const parsed = RuntimeStateSchema.safeParse(raw)
  if (!parsed.success) {
    throw new BoundaryValidationError('Invalid runtime state payload', parsed.error.message)
  }

  return parsed.data
}

export function serializeRuntimeState(state: RuntimeState): string {
  const normalized = RuntimeStateSchema.parse(state)
  return `${JSON.stringify(normalized, null, 2)}\n`
}
