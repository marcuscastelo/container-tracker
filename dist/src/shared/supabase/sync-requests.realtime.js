import { z } from 'zod/v4';
const SyncRequestStatusSchema = z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED']);
const SyncRequestRealtimeRowSchema = z
    .object({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    status: SyncRequestStatusSchema,
    last_error: z.string().nullable().optional().default(null),
    updated_at: z.string().nullable().optional().default(null),
    ref_value: z.string().nullable().optional().default(null),
    leased_by: z.string().nullable().optional().default(null),
    leased_until: z.string().nullable().optional().default(null),
})
    .passthrough();
const RealtimeEventTypeSchema = z.enum(['INSERT', 'UPDATE', 'DELETE']);
const RealtimePayloadSchema = z.object({
    eventType: RealtimeEventTypeSchema,
    old: z.unknown().optional(),
    new: z.unknown().optional(),
});
const RealtimeChannelStateSchema = z.enum(['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);
const SyncRequestIdListSchema = z.array(z.string().uuid()).min(1);
const SyncRequestContainerRefListSchema = z.array(z.string()).min(1);
const SyncRequestTenantIdSchema = z.string().uuid();
function toChannelName(scope, key) {
    const randomSuffix = typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `sync_requests:${scope}:${key}:${randomSuffix}`;
}
function parseSyncRequestRow(value) {
    const parsed = SyncRequestRealtimeRowSchema.safeParse(value);
    if (!parsed.success) {
        return null;
    }
    return parsed.data;
}
function normalizeRealtimeEvent(payload) {
    const parsedPayload = RealtimePayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
        return null;
    }
    const row = parseSyncRequestRow(parsedPayload.data.new);
    const oldRow = parseSyncRequestRow(parsedPayload.data.old);
    if (!row && !oldRow) {
        return null;
    }
    return {
        eventType: parsedPayload.data.eventType,
        row,
        oldRow,
    };
}
function emitChannelStatus(command) {
    if (!command.onStatus)
        return;
    const parsedStatus = RealtimeChannelStateSchema.safeParse(command.rawStatus);
    if (!parsedStatus.success)
        return;
    command.onStatus({
        state: parsedStatus.data,
        scope: command.scope,
        key: command.key,
        errorMessage: command.error?.message ?? null,
    });
}
function subscribeToSyncRequestsFilters(command) {
    const channels = command.filters.map((filterItem) => {
        const channel = command.client.channel(toChannelName(filterItem.scope, filterItem.key));
        channel
            .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'sync_requests',
            filter: filterItem.key,
        }, (payload) => {
            const event = normalizeRealtimeEvent(payload);
            if (!event)
                return;
            command.onEvent(event);
        })
            .subscribe((status, error) => {
            emitChannelStatus({
                rawStatus: status,
                error,
                scope: filterItem.scope,
                key: filterItem.key,
                onStatus: command.onStatus,
            });
        });
        return channel;
    });
    let unsubscribed = false;
    return {
        unsubscribe() {
            if (unsubscribed)
                return;
            unsubscribed = true;
            for (const channel of channels) {
                void command.client.removeChannel(channel);
            }
        },
    };
}
export function subscribeSyncRequestsByIds(command) {
    const parsedSyncRequestIds = SyncRequestIdListSchema.parse(command.syncRequestIds);
    const uniqueSyncRequestIds = Array.from(new Set(parsedSyncRequestIds));
    return subscribeToSyncRequestsFilters({
        client: command.client,
        filters: uniqueSyncRequestIds.map((syncRequestId) => ({
            scope: 'ids',
            key: `id=eq.${syncRequestId}`,
        })),
        onEvent: command.onEvent,
        ...(command.onStatus ? { onStatus: command.onStatus } : {}),
    });
}
function normalizeContainerRefValue(value) {
    return value.trim().toUpperCase();
}
export function subscribeSyncRequestsByContainerRefs(command) {
    const parsedContainerNumbers = SyncRequestContainerRefListSchema.parse(command.containerNumbers);
    const uniqueContainerNumbers = Array.from(new Set(parsedContainerNumbers
        .map((containerNumber) => normalizeContainerRefValue(containerNumber))
        .filter((containerNumber) => containerNumber.length > 0)));
    if (uniqueContainerNumbers.length === 0) {
        throw new Error('containerNumbers must contain at least one non-empty container reference');
    }
    return subscribeToSyncRequestsFilters({
        client: command.client,
        filters: uniqueContainerNumbers.map((containerNumber) => ({
            // Use a dedicated scope name for container ref subscriptions and
            // filter by both ref_type and ref_value to avoid matching unrelated
            // sync_requests rows that share the same ref_value for other ref_types.
            scope: 'container_refs',
            key: `ref_type=eq.container&ref_value=eq.${containerNumber}`,
        })),
        onEvent: command.onEvent,
        ...(command.onStatus ? { onStatus: command.onStatus } : {}),
    });
}
export function subscribeSyncRequestsByTenant(command) {
    const tenantId = SyncRequestTenantIdSchema.parse(command.tenantId);
    return subscribeToSyncRequestsFilters({
        client: command.client,
        filters: [
            {
                scope: 'tenant',
                key: `tenant_id=eq.${tenantId}`,
            },
        ],
        onEvent: command.onEvent,
        ...(command.onStatus ? { onStatus: command.onStatus } : {}),
    });
}
