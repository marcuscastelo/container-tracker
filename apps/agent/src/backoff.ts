export type ExponentialBackoffConfig = {
  readonly baseMs: number
  readonly factor: number
  readonly capMs: number
  readonly jitterRatio: number
}

export const ENROLL_BACKOFF_CONFIG: ExponentialBackoffConfig = {
  baseMs: 5_000,
  factor: 2,
  capMs: 300_000,
  jitterRatio: 0.2,
}

export function computeBackoffDelayMs(
  attempt: number,
  command: {
    readonly config?: ExponentialBackoffConfig
    readonly randomValue?: number
  } = {},
): number {
  const config = command.config ?? ENROLL_BACKOFF_CONFIG
  const randomValue = command.randomValue ?? Math.random()

  const boundedRandom = Math.min(1, Math.max(0, randomValue))
  const exponentialDelay = Math.min(config.capMs, config.baseMs * config.factor ** attempt)
  const jitterRange = exponentialDelay * config.jitterRatio
  const jitterOffset = (boundedRandom * 2 - 1) * jitterRange

  return Math.max(0, Math.round(exponentialDelay + jitterOffset))
}
