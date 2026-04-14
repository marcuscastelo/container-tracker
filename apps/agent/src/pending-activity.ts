import fs from 'node:fs'
import { writeFileAtomic } from '@agent/state/file-io'
import { z } from 'zod/v4'

const activityEventSchema = z.object({
  type: z.enum([
    'ENROLLED',
    'HEARTBEAT',
    'LEASED_TARGET',
    'SNAPSHOT_INGESTED',
    'REQUEST_FAILED',
    'REALTIME_SUBSCRIBED',
    'REALTIME_CHANNEL_ERROR',
    'LEASE_CONFLICT',
    'UPDATE_CHECKED',
    'UPDATE_AVAILABLE',
    'UPDATE_DOWNLOAD_STARTED',
    'UPDATE_DOWNLOAD_COMPLETED',
    'UPDATE_READY',
    'UPDATE_APPLY_STARTED',
    'UPDATE_APPLY_FAILED',
    'RESTART_FOR_UPDATE',
    'ROLLBACK_EXECUTED',
    'LOCAL_UPDATE_PAUSED',
    'LOCAL_UPDATE_RESUMED',
    'CHANNEL_CHANGED',
    'CONFIG_UPDATED',
    'RELEASE_ACTIVATED',
    'LOCAL_RESET',
    'REMOTE_RESET',
    'REMOTE_FORCE_UPDATE',
  ]),
  message: z.string().min(1),
  severity: z.enum(['info', 'warning', 'danger', 'success']),
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurred_at: z.string().datetime({ offset: true }),
})

const activityEventListSchema = z.array(activityEventSchema)

export type PendingActivityEvent = z.infer<typeof activityEventSchema>

function readEvents(filePath: string): readonly PendingActivityEvent[] {
  if (!fs.existsSync(filePath)) {
    return []
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const eventsResult = activityEventListSchema.safeParse(parsed)
    if (!eventsResult.success) {
      return []
    }
    return eventsResult.data
  } catch {
    return []
  }
}

export function appendPendingActivityEvents(
  filePath: string,
  events: readonly PendingActivityEvent[],
): void {
  if (events.length === 0) {
    return
  }

  const existing = readEvents(filePath)
  const normalized = activityEventListSchema.parse([...existing, ...events])
  writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`)
}

export function drainPendingActivityEvents(filePath: string): readonly PendingActivityEvent[] {
  const events = readEvents(filePath)
  if (events.length === 0) {
    return []
  }

  writeFileAtomic(filePath, '[]\n')
  return events
}
