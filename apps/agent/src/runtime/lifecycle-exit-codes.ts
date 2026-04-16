export const EXIT_OK = 0
export const EXIT_FATAL = 1
export const EXIT_UPDATE_RESTART = 42
export const EXIT_CONFIG_ERROR = 50

export type SupervisorExitAction =
  | 'stop-graceful'
  | 'restart-for-update'
  | 'stop-config-error'
  | 'restart-after-failure'

export function resolveSupervisorExitAction(exitCode: number | null): SupervisorExitAction {
  if (exitCode === EXIT_UPDATE_RESTART) {
    return 'restart-for-update'
  }

  if (exitCode === EXIT_OK) {
    return 'stop-graceful'
  }

  if (exitCode === EXIT_CONFIG_ERROR) {
    return 'stop-config-error'
  }

  return 'restart-after-failure'
}
