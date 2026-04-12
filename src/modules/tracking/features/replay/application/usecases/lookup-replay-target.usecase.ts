import type { TrackingReplayAdminRepository } from '~/modules/tracking/features/replay/application/ports/tracking-replay-admin.repository'
import type { ReplayTargetLookup } from '~/modules/tracking/features/replay/domain/replay-run'
import { HttpError } from '~/shared/errors/httpErrors'

export type LookupReplayTargetCommand = {
  readonly containerNumber: string
}

export async function lookupReplayTarget(
  deps: {
    readonly replayAdminRepository: TrackingReplayAdminRepository
  },
  command: LookupReplayTargetCommand,
): Promise<ReplayTargetLookup> {
  const normalizedContainerNumber = command.containerNumber.trim().toUpperCase()
  if (normalizedContainerNumber.length === 0) {
    throw new HttpError('tracking_replay_container_number_required', 400)
  }

  const target =
    await deps.replayAdminRepository.findTargetByContainerNumber(normalizedContainerNumber)
  if (target === null) {
    throw new HttpError('tracking_replay_container_not_found', 404)
  }

  return target
}
