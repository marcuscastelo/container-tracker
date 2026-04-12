import type { ReplayMode } from '~/modules/tracking/features/replay/domain/replay-status'

export type ReplayActiveLock = {
  readonly containerId: string
  readonly runId: string
  readonly runTargetId: string
  readonly ownerToken: string
  readonly mode: ReplayMode
  readonly acquiredAt: string
  readonly heartbeatAt: string
  readonly expiresAt: string
}

export type ReplayLockAcquireResult = {
  readonly acquired: boolean
  readonly lockOwnerRunTargetId: string | null
  readonly expiresAt: string | null
}

export type TrackingReplayLockRepository = {
  acquire(command: {
    readonly containerId: string
    readonly runId: string
    readonly runTargetId: string
    readonly mode: ReplayMode
    readonly ownerToken: string
    readonly ttlSeconds: number
  }): Promise<ReplayLockAcquireResult>

  heartbeat(command: {
    readonly containerId: string
    readonly runTargetId: string
    readonly ownerToken: string
    readonly ttlSeconds: number
  }): Promise<boolean>

  release(command: {
    readonly containerId: string
    readonly runTargetId: string
    readonly ownerToken: string
  }): Promise<boolean>

  findActiveLockByContainerId(containerId: string): Promise<ReplayActiveLock | null>

  hasActiveLockForContainerNumber(containerNumber: string): Promise<boolean>
}
