export type ChildRunOutcome = {
  readonly exitCode: number | null
  readonly startupConfirmed: boolean
  readonly startupTimedOut: boolean
  readonly healthGraceConfirmed: boolean
}
