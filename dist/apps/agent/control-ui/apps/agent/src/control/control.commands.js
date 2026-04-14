import { randomUUID } from 'node:crypto';
import { z } from 'zod/v4';
const baseCommandSchema = z.object({
    id: z.string().uuid(),
    requestedAt: z.string().datetime({ offset: true }),
});
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
]);
const emptyPayloadSchema = z.object({});
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
]);
export function createControlCommand(command) {
    return ControlCommandSchema.parse({
        id: command.id ?? randomUUID(),
        requestedAt: command.requestedAt ?? new Date().toISOString(),
        type: command.type,
        payload: command.payload,
    });
}
