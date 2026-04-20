import {
  clearSupervisorControl,
  writeSupervisorControl,
} from '@agent/runtime/infrastructure/supervisor-control.repository'

export function requestRuntimeDrain(command: {
  readonly supervisorControlPath: string
  readonly reason: 'update' | 'restart' | 'manual'
  readonly requestedAt: string
}): void {
  writeSupervisorControl(command.supervisorControlPath, {
    drain_requested: true,
    reason: command.reason,
    requested_at: command.requestedAt,
  })
}

export function clearRuntimeDrain(supervisorControlPath: string): void {
  clearSupervisorControl(supervisorControlPath)
}
