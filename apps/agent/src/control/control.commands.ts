import { randomUUID } from 'node:crypto'
import { z } from 'zod/v4'

const baseCommandSchema = z.object({
  id: z.string().uuid(),
  requestedAt: z.string().datetime({ offset: true }),
})

export const ControlCommandTypeSchema = z.enum([
  'start-agent',
  'stop-agent',
  'restart-agent',
  'pause-updates',
  'resume-updates',
  'change-channel',
  'set-blocked-versions',
  'update-config',
  'set-backend-url',
  'activate-release',
  'rollback-release',
  'execute-local-reset',
])

const emptyPayloadSchema = z.object({})

export const ControlCommandSchema = z.discriminatedUnion('type', [
  baseCommandSchema.extend({ type: z.literal('start-agent'), payload: emptyPayloadSchema }),
  baseCommandSchema.extend({ type: z.literal('stop-agent'), payload: emptyPayloadSchema }),
  baseCommandSchema.extend({ type: z.literal('restart-agent'), payload: emptyPayloadSchema }),
  baseCommandSchema.extend({ type: z.literal('pause-updates'), payload: emptyPayloadSchema }),
  baseCommandSchema.extend({ type: z.literal('resume-updates'), payload: emptyPayloadSchema }),
  baseCommandSchema.extend({
    type: z.literal('change-channel'),
    payload: z.object({ channel: z.string().trim().min(1).nullable() }),
  }),
  baseCommandSchema.extend({
    type: z.literal('set-blocked-versions'),
    payload: z.object({ versions: z.array(z.string().trim().min(1)) }),
  }),
  baseCommandSchema.extend({
    type: z.literal('update-config'),
    payload: z.object({ patch: z.record(z.string(), z.string()) }),
  }),
  baseCommandSchema.extend({
    type: z.literal('set-backend-url'),
    payload: z.object({ backendUrl: z.string().trim().url() }),
  }),
  baseCommandSchema.extend({
    type: z.literal('activate-release'),
    payload: z.object({ version: z.string().trim().min(1) }),
  }),
  baseCommandSchema.extend({ type: z.literal('rollback-release'), payload: emptyPayloadSchema }),
  baseCommandSchema.extend({ type: z.literal('execute-local-reset'), payload: emptyPayloadSchema }),
])

export type ControlCommandType = z.infer<typeof ControlCommandTypeSchema>
export type ControlCommand = z.infer<typeof ControlCommandSchema>

type EmptyPayload = Record<string, never>

export type ControlCommandPayloadByType = {
  readonly 'start-agent': EmptyPayload
  readonly 'stop-agent': EmptyPayload
  readonly 'restart-agent': EmptyPayload
  readonly 'pause-updates': EmptyPayload
  readonly 'resume-updates': EmptyPayload
  readonly 'change-channel': {
    readonly channel: string | null
  }
  readonly 'set-blocked-versions': {
    readonly versions: readonly string[]
  }
  readonly 'update-config': {
    readonly patch: Record<string, string>
  }
  readonly 'set-backend-url': {
    readonly backendUrl: string
  }
  readonly 'activate-release': {
    readonly version: string
  }
  readonly 'rollback-release': EmptyPayload
  readonly 'execute-local-reset': EmptyPayload
}

export function createControlCommand<T extends ControlCommandType>(command: {
  readonly id?: string
  readonly requestedAt?: string
  readonly type: T
  readonly payload: ControlCommandPayloadByType[T]
}): ControlCommand {
  return ControlCommandSchema.parse({
    id: command.id ?? randomUUID(),
    requestedAt: command.requestedAt ?? new Date().toISOString(),
    type: command.type,
    payload: command.payload,
  })
}
