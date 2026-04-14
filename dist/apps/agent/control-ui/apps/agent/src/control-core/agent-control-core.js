import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { AgentControlAuditEventSchema, AgentControlRemoteCacheSchema, AgentControlStateResponseSchema, AgentInfraConfigCacheSchema, AgentInfraConfigResponseSchema, AgentOperationalSnapshotSchema, LocalOverrideStateSchema, } from './contracts.js';
import { appendPendingActivityEvents } from '../pending-activity.js';
import { readReleaseState, writeReleaseState } from '../release-state.js';
import { readRuntimeHealth } from '../runtime-health.js';
import { z } from 'zod/v4';
export const ControlRuntimeConfigSchema = z.object({
    AGENT_ID: z.string().min(1),
    AGENT_TOKEN: z.string().min(1),
    AGENT_UPDATE_MANIFEST_CHANNEL: z.string().min(1),
    BACKEND_URL: z.string().url(),
    INTERVAL_SEC: z.number().int().positive(),
    LIMIT: z.number().int().min(1).max(100),
    MAERSK_ENABLED: z.boolean(),
    MAERSK_HEADLESS: z.boolean(),
    MAERSK_TIMEOUT_MS: z.number().int().positive(),
    MAERSK_USER_DATA_DIR: z.string().min(1).nullable(),
    SUPABASE_ANON_KEY: z.string().min(1).nullable(),
    SUPABASE_URL: z.string().url().nullable(),
    TENANT_ID: z.string().uuid(),
});
const EditableConfigKeySchema = z.enum([
    'INTERVAL_SEC',
    'LIMIT',
    'MAERSK_ENABLED',
    'MAERSK_HEADLESS',
    'MAERSK_TIMEOUT_MS',
    'MAERSK_USER_DATA_DIR',
]);
const EDITABLE_CONFIG_KEYS = EditableConfigKeySchema.options;
const REMOTE_CONTROL_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const INFRA_CONFIG_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
function normalizeOptionalString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
function unquoteValue(value) {
    if (value.length < 2) {
        return value;
    }
    const first = value.at(0);
    const last = value.at(-1);
    if (!first || !last) {
        return value;
    }
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
        return value.slice(1, -1);
    }
    return value;
}
function parseEnvLine(line) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
        return null;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
        return null;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key.length === 0) {
        return null;
    }
    return {
        key,
        value: unquoteValue(value),
    };
}
function parseBooleanFlag(value) {
    const normalized = normalizeOptionalString(value)?.toLowerCase();
    if (normalized === null) {
        return null;
    }
    if (normalized === '1' || normalized === 'true') {
        return true;
    }
    if (normalized === '0' || normalized === 'false') {
        return false;
    }
    return null;
}
function writeFileAtomic(filePath, content) {
    const parentDir = path.dirname(filePath);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
}
function uniqueStrings(values) {
    return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
function defaultRemoteControlState() {
    return AgentControlStateResponseSchema.parse({
        policy: {},
        commands: [],
    });
}
function defaultLocalOverrides() {
    return LocalOverrideStateSchema.parse({});
}
function readJsonFile(filePath, schema) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const normalized = schema.safeParse(parsed);
        if (!normalized.success) {
            return null;
        }
        return normalized.data;
    }
    catch {
        return null;
    }
}
function writeJsonFile(filePath, schema, value) {
    const normalized = schema.parse(value);
    writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
}
function booleanToEnvString(value) {
    return value ? 'true' : 'false';
}
export function serializeRuntimeConfig(config) {
    const lines = [
        `BACKEND_URL=${config.BACKEND_URL}`,
        `AGENT_TOKEN=${config.AGENT_TOKEN}`,
        `TENANT_ID=${config.TENANT_ID}`,
        `AGENT_ID=${config.AGENT_ID}`,
        `INTERVAL_SEC=${config.INTERVAL_SEC}`,
        `LIMIT=${config.LIMIT}`,
        `MAERSK_ENABLED=${config.MAERSK_ENABLED ? '1' : '0'}`,
        `MAERSK_HEADLESS=${booleanToEnvString(config.MAERSK_HEADLESS)}`,
        `MAERSK_TIMEOUT_MS=${config.MAERSK_TIMEOUT_MS}`,
        `AGENT_UPDATE_MANIFEST_CHANNEL=${config.AGENT_UPDATE_MANIFEST_CHANNEL}`,
    ];
    const maerskUserDataDir = normalizeOptionalString(config.MAERSK_USER_DATA_DIR);
    lines.push(`MAERSK_USER_DATA_DIR=${maerskUserDataDir ?? ''}`);
    const supabaseUrl = normalizeOptionalString(config.SUPABASE_URL);
    if (supabaseUrl) {
        lines.push(`SUPABASE_URL=${supabaseUrl}`);
    }
    const supabaseAnonKey = normalizeOptionalString(config.SUPABASE_ANON_KEY);
    if (supabaseAnonKey) {
        lines.push(`SUPABASE_ANON_KEY=${supabaseAnonKey}`);
    }
    return `${lines.join('\n')}\n`;
}
function readBaseConfig(layout, fallback) {
    const existing = readJsonFile(layout.baseRuntimeConfigPath, ControlRuntimeConfigSchema);
    if (existing) {
        return existing;
    }
    writeJsonFile(layout.baseRuntimeConfigPath, ControlRuntimeConfigSchema, fallback);
    return fallback;
}
export function readCurrentControlRuntimeConfig(layout) {
    const existingBaseConfig = readJsonFile(layout.baseRuntimeConfigPath, ControlRuntimeConfigSchema);
    if (existingBaseConfig) {
        return existingBaseConfig;
    }
    if (!fs.existsSync(layout.configPath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(layout.configPath, 'utf8');
        const values = new Map();
        for (const line of raw.split(/\r?\n/u)) {
            const parsed = parseEnvLine(line);
            if (!parsed) {
                continue;
            }
            values.set(parsed.key, parsed.value);
        }
        return ControlRuntimeConfigSchema.parse({
            BACKEND_URL: values.get('BACKEND_URL'),
            SUPABASE_URL: normalizeOptionalString(values.get('SUPABASE_URL') ?? null),
            SUPABASE_ANON_KEY: normalizeOptionalString(values.get('SUPABASE_ANON_KEY') ?? null),
            AGENT_TOKEN: values.get('AGENT_TOKEN'),
            TENANT_ID: values.get('TENANT_ID'),
            AGENT_ID: values.get('AGENT_ID'),
            INTERVAL_SEC: Number.parseInt(values.get('INTERVAL_SEC') ?? '', 10),
            LIMIT: Number.parseInt(values.get('LIMIT') ?? '', 10),
            MAERSK_ENABLED: parseBooleanFlag(values.get('MAERSK_ENABLED') ?? null) ?? false,
            MAERSK_HEADLESS: parseBooleanFlag(values.get('MAERSK_HEADLESS') ?? null) ?? true,
            MAERSK_TIMEOUT_MS: Number.parseInt(values.get('MAERSK_TIMEOUT_MS') ?? '', 10),
            MAERSK_USER_DATA_DIR: normalizeOptionalString(values.get('MAERSK_USER_DATA_DIR') ?? null),
            AGENT_UPDATE_MANIFEST_CHANNEL: normalizeOptionalString(values.get('AGENT_UPDATE_MANIFEST_CHANNEL') ?? null) ?? 'stable',
        });
    }
    catch {
        return null;
    }
}
export function ensureBaseRuntimeConfig(layout, config) {
    return readBaseConfig(layout, ControlRuntimeConfigSchema.parse(config));
}
export function readLocalOverrideState(layout) {
    return (readJsonFile(layout.controlOverridesPath, LocalOverrideStateSchema) ?? defaultLocalOverrides());
}
function writeLocalOverrideState(layout, value) {
    const normalized = LocalOverrideStateSchema.parse(value);
    writeJsonFile(layout.controlOverridesPath, LocalOverrideStateSchema, normalized);
    return normalized;
}
function readRemoteControlCache(layout) {
    return readJsonFile(layout.controlRemoteCachePath, AgentControlRemoteCacheSchema);
}
function writeRemoteControlCache(layout, value) {
    writeJsonFile(layout.controlRemoteCachePath, AgentControlRemoteCacheSchema, value);
}
function readInfraConfigCache(layout) {
    return readJsonFile(layout.infraConfigPath, AgentInfraConfigCacheSchema);
}
function writeInfraConfigCache(layout, value) {
    writeJsonFile(layout.infraConfigPath, AgentInfraConfigCacheSchema, value);
}
function isRecentCache(fetchedAt, maxAgeMs) {
    const parsed = new Date(fetchedAt).getTime();
    if (Number.isNaN(parsed)) {
        return false;
    }
    return Date.now() - parsed <= maxAgeMs;
}
function appendAuditEvent(layout, value) {
    const normalized = AgentControlAuditEventSchema.parse(value);
    const line = `${JSON.stringify(normalized)}\n`;
    fs.mkdirSync(path.dirname(layout.auditLogPath), { recursive: true });
    fs.appendFileSync(layout.auditLogPath, line, 'utf8');
}
export function recordOperationalEvent(layout, value) {
    const normalized = AgentControlAuditEventSchema.parse(value);
    appendAuditEvent(layout, normalized);
    appendPendingActivityEvents(layout.pendingActivityPath, [
        {
            type: normalized.type,
            message: normalized.message,
            severity: resolvePendingActivitySeverity(normalized.type),
            metadata: normalized.metadata,
            occurred_at: normalized.occurredAt,
        },
    ]);
}
function resolvePendingActivitySeverity(type) {
    if (type === 'LOCAL_UPDATE_PAUSED' || type === 'REMOTE_RESET' || type === 'REMOTE_FORCE_UPDATE') {
        return 'warning';
    }
    if (type === 'LOCAL_UPDATE_RESUMED' || type === 'RELEASE_ACTIVATED') {
        return 'success';
    }
    return 'info';
}
function readEditableConfig(baseConfig, effectiveConfig) {
    return {
        INTERVAL_SEC: String(effectiveConfig.INTERVAL_SEC),
        LIMIT: String(effectiveConfig.LIMIT),
        MAERSK_ENABLED: effectiveConfig.MAERSK_ENABLED ? '1' : '0',
        MAERSK_HEADLESS: booleanToEnvString(effectiveConfig.MAERSK_HEADLESS),
        MAERSK_TIMEOUT_MS: String(effectiveConfig.MAERSK_TIMEOUT_MS),
        MAERSK_USER_DATA_DIR: normalizeOptionalString(effectiveConfig.MAERSK_USER_DATA_DIR) ?? '',
        BASE_INTERVAL_SEC: String(baseConfig.INTERVAL_SEC),
    };
}
function parseEditableNumber(value, minimum) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < minimum) {
        return null;
    }
    return parsed;
}
function parseEditableBoolean(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true')
        return true;
    if (normalized === '0' || normalized === 'false')
        return false;
    return null;
}
function applyEditableConfig(baseConfig, editableConfig) {
    let nextConfig = baseConfig;
    for (const key of EDITABLE_CONFIG_KEYS) {
        const rawValue = editableConfig[key];
        if (typeof rawValue !== 'string') {
            continue;
        }
        if (key === 'INTERVAL_SEC') {
            const parsed = parseEditableNumber(rawValue, 1);
            if (parsed !== null) {
                nextConfig = { ...nextConfig, INTERVAL_SEC: parsed };
            }
            continue;
        }
        if (key === 'LIMIT') {
            const parsed = parseEditableNumber(rawValue, 1);
            if (parsed !== null) {
                nextConfig = { ...nextConfig, LIMIT: Math.min(parsed, 100) };
            }
            continue;
        }
        if (key === 'MAERSK_ENABLED') {
            const parsed = parseEditableBoolean(rawValue);
            if (parsed !== null) {
                nextConfig = { ...nextConfig, MAERSK_ENABLED: parsed };
            }
            continue;
        }
        if (key === 'MAERSK_HEADLESS') {
            const parsed = parseEditableBoolean(rawValue);
            if (parsed !== null) {
                nextConfig = { ...nextConfig, MAERSK_HEADLESS: parsed };
            }
            continue;
        }
        if (key === 'MAERSK_TIMEOUT_MS') {
            const parsed = parseEditableNumber(rawValue, 1);
            if (parsed !== null) {
                nextConfig = { ...nextConfig, MAERSK_TIMEOUT_MS: parsed };
            }
            continue;
        }
        if (key === 'MAERSK_USER_DATA_DIR') {
            nextConfig = {
                ...nextConfig,
                MAERSK_USER_DATA_DIR: normalizeOptionalString(rawValue),
            };
        }
    }
    return nextConfig;
}
function resolveRuntimeStatus(runtimeHealth) {
    if (!runtimeHealth) {
        return {
            status: 'STOPPED',
            health: 'UNHEALTHY',
        };
    }
    if (runtimeHealth.boot_status === 'healthy') {
        return {
            status: 'RUNNING',
            health: 'HEALTHY',
        };
    }
    if (runtimeHealth.boot_status === 'degraded') {
        return {
            status: 'DEGRADED',
            health: 'DEGRADED',
        };
    }
    return {
        status: 'CRASHED',
        health: 'UNHEALTHY',
    };
}
function resolveValue(command) {
    if (command.remotePolicy !== null) {
        const overridden = [];
        if (command.local !== null) {
            overridden.push({ source: 'LOCAL', value: command.local });
        }
        overridden.push({ source: 'BASE', value: command.base });
        return {
            value: command.remotePolicy,
            source: 'REMOTE_POLICY',
            overridden,
        };
    }
    if (command.local !== null) {
        return {
            value: command.local,
            source: 'LOCAL',
            overridden: [{ source: 'BASE', value: command.base }],
        };
    }
    return {
        value: command.base,
        source: 'BASE',
        overridden: [],
    };
}
function resolveEffectiveConfig(command) {
    let effectiveConfig = applyEditableConfig(command.baseConfig, command.localOverrides.editableConfig);
    const channelResolution = resolveValue({
        base: command.baseConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
        local: normalizeOptionalString(command.localOverrides.channel),
        remotePolicy: normalizeOptionalString(command.remotePolicy.updateChannel),
    });
    effectiveConfig = {
        ...effectiveConfig,
        AGENT_UPDATE_MANIFEST_CHANNEL: channelResolution.value,
    };
    if (command.infraConfig) {
        effectiveConfig = {
            ...effectiveConfig,
            SUPABASE_URL: command.infraConfig.supabaseUrl,
            SUPABASE_ANON_KEY: command.infraConfig.supabaseAnonKey,
        };
    }
    return ControlRuntimeConfigSchema.parse(effectiveConfig);
}
async function fetchJson(command) {
    const response = await fetch(command.url, {
        headers: {
            authorization: `Bearer ${command.token}`,
        },
    });
    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
        const errorMessage = typeof raw === 'object' && raw !== null && 'error' in raw && typeof raw.error === 'string'
            ? raw.error
            : response.statusText;
        throw new Error(errorMessage);
    }
    return command.schema.parse(raw);
}
async function fetchRemoteControlState(config) {
    return fetchJson({
        url: new URL('/api/agent/control-state', config.BACKEND_URL).toString(),
        token: config.AGENT_TOKEN,
        schema: AgentControlStateResponseSchema,
    });
}
async function fetchInfraConfig(config) {
    return fetchJson({
        url: new URL('/api/agent/infra-config', config.BACKEND_URL).toString(),
        token: config.AGENT_TOKEN,
        schema: AgentInfraConfigResponseSchema,
    });
}
export async function acknowledgeRemoteCommand(command) {
    await fetch(new URL(`/api/agent/control-commands/${command.remoteCommandId}/ack`, command.config.BACKEND_URL), {
        method: 'POST',
        headers: {
            authorization: `Bearer ${command.config.AGENT_TOKEN}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            status: command.status ?? 'APPLIED',
            detail: command.detail ?? null,
        }),
    });
}
function clearReleaseStateLocalFlags(state) {
    return {
        ...state,
        target_version: null,
        activation_state: 'idle',
        blocked_versions: [],
        automatic_updates_blocked: false,
        recent_failures: [],
        activation_failures: {},
        last_error: null,
    };
}
function createSnapshot(command) {
    const runtimeStatus = resolveRuntimeStatus(command.runtimeHealth);
    const localBlockedVersions = uniqueStrings([
        ...command.releaseState.blocked_versions,
        ...command.localOverrides.blockedVersions,
    ]);
    const remoteBlockedVersions = uniqueStrings(command.remotePolicy.blockedVersions);
    const paused = resolveValue({
        base: false,
        local: command.localOverrides.updatesPaused,
        remotePolicy: command.remotePolicy.updatesPaused ? true : null,
    });
    const channel = resolveValue({
        base: command.baseConfig.AGENT_UPDATE_MANIFEST_CHANNEL,
        local: normalizeOptionalString(command.localOverrides.channel),
        remotePolicy: normalizeOptionalString(command.remotePolicy.updateChannel),
    });
    const infraUrl = command.infraConfig?.supabaseUrl ??
        normalizeOptionalString(command.effectiveConfig.SUPABASE_URL) ??
        command.baseConfig.BACKEND_URL;
    return AgentOperationalSnapshotSchema.parse({
        runtime: {
            status: runtimeStatus.status,
            health: runtimeStatus.health,
            lastHeartbeatAt: command.runtimeHealth?.last_heartbeat_at ?? null,
            activeJobs: command.runtimeHealth?.active_jobs ?? 0,
        },
        release: {
            current: command.releaseState.current_version,
            previous: command.releaseState.previous_version,
            target: command.releaseState.target_version,
        },
        updates: {
            paused,
            channel,
            blockedVersions: {
                local: localBlockedVersions,
                remote: remoteBlockedVersions,
                effective: uniqueStrings([...localBlockedVersions, ...remoteBlockedVersions]),
            },
            forceTargetVersion: command.remotePolicy.desiredVersion,
        },
        config: {
            editable: readEditableConfig(command.baseConfig, command.effectiveConfig),
            requiresRestart: uniqueStrings(Object.keys(command.localOverrides.editableConfig)),
        },
        infra: {
            supabaseUrl: infraUrl,
            source: command.infraSource,
        },
    });
}
export async function syncAgentControlState(command) {
    const baseConfig = ensureBaseRuntimeConfig(command.layout, command.currentConfig);
    const remoteControlCache = readRemoteControlCache(command.layout);
    let remoteState = defaultRemoteControlState();
    if (remoteControlCache &&
        isRecentCache(remoteControlCache.fetchedAt, REMOTE_CONTROL_CACHE_MAX_AGE_MS)) {
        remoteState = remoteControlCache.state;
    }
    if (command.forceRemoteFetch !== false) {
        try {
            const fetchedRemoteState = await fetchRemoteControlState(command.currentConfig);
            remoteState = fetchedRemoteState;
            writeRemoteControlCache(command.layout, {
                fetchedAt: new Date().toISOString(),
                state: fetchedRemoteState,
            });
        }
        catch {
            // fall back to cache below
        }
    }
    const infraConfigCache = readInfraConfigCache(command.layout);
    let infraConfig = infraConfigCache && isRecentCache(infraConfigCache.fetchedAt, INFRA_CONFIG_CACHE_MAX_AGE_MS)
        ? infraConfigCache.config
        : null;
    let infraSource = 'FALLBACK';
    if (command.forceRemoteFetch !== false) {
        try {
            const fetchedInfraConfig = await fetchInfraConfig(command.currentConfig);
            infraConfig = fetchedInfraConfig;
            infraSource = 'REMOTE';
            writeInfraConfigCache(command.layout, {
                fetchedAt: new Date().toISOString(),
                config: fetchedInfraConfig,
            });
        }
        catch {
            infraSource = 'FALLBACK';
        }
    }
    const localOverrides = readLocalOverrideState(command.layout);
    const effectiveConfig = resolveEffectiveConfig({
        baseConfig,
        localOverrides,
        remotePolicy: remoteState.policy,
        infraConfig,
    });
    writeFileAtomic(command.layout.configPath, serializeRuntimeConfig(effectiveConfig));
    const runtimeHealth = readRuntimeHealth(command.layout.runtimeHealthPath);
    const releaseState = readReleaseState(command.layout.releaseStatePath, runtimeHealth?.agent_version ?? effectiveConfig.AGENT_ID);
    const snapshot = createSnapshot({
        baseConfig,
        effectiveConfig,
        runtimeHealth,
        releaseState,
        localOverrides,
        remotePolicy: remoteState.policy,
        infraConfig,
        infraSource,
    });
    return {
        baseConfig,
        effectiveConfig,
        localOverrides,
        remotePolicy: remoteState.policy,
        remoteCommands: remoteState.commands,
        releaseState,
        runtimeHealth,
        snapshot,
    };
}
function updateOverrides(command) {
    const current = readLocalOverrideState(command.layout);
    return writeLocalOverrideState(command.layout, command.mutator(current));
}
export function setLocalUpdatesPaused(command) {
    const overrides = updateOverrides({
        layout: command.layout,
        mutator(current) {
            return {
                ...current,
                updatesPaused: command.paused,
            };
        },
    });
    recordOperationalEvent(command.layout, {
        type: command.paused ? 'LOCAL_UPDATE_PAUSED' : 'LOCAL_UPDATE_RESUMED',
        occurredAt: new Date().toISOString(),
        source: 'LOCAL',
        message: command.paused ? 'Local update pause enabled' : 'Local update pause cleared',
        metadata: {},
    });
    return overrides;
}
export function setLocalChannel(command) {
    const normalizedChannel = normalizeOptionalString(command.channel);
    const overrides = updateOverrides({
        layout: command.layout,
        mutator(current) {
            return {
                ...current,
                channel: normalizedChannel,
            };
        },
    });
    recordOperationalEvent(command.layout, {
        type: 'CHANNEL_CHANGED',
        occurredAt: new Date().toISOString(),
        source: 'LOCAL',
        message: `Local update channel set to ${normalizedChannel ?? 'base'}`,
        metadata: {
            channel: normalizedChannel,
        },
    });
    return overrides;
}
export function setLocalBlockedVersions(command) {
    return updateOverrides({
        layout: command.layout,
        mutator(current) {
            return {
                ...current,
                blockedVersions: uniqueStrings(command.blockedVersions),
            };
        },
    });
}
export function updateLocalEditableConfig(command) {
    const filteredPatch = {};
    for (const key of EDITABLE_CONFIG_KEYS) {
        const candidate = command.patch[key];
        if (typeof candidate === 'string') {
            filteredPatch[key] = candidate;
        }
    }
    const overrides = updateOverrides({
        layout: command.layout,
        mutator(current) {
            return {
                ...current,
                editableConfig: {
                    ...current.editableConfig,
                    ...filteredPatch,
                },
            };
        },
    });
    recordOperationalEvent(command.layout, {
        type: 'CONFIG_UPDATED',
        occurredAt: new Date().toISOString(),
        source: 'LOCAL',
        message: 'Local config overrides updated',
        metadata: {
            keys: Object.keys(filteredPatch),
        },
    });
    return overrides;
}
export async function executeLocalReset(command) {
    writeLocalOverrideState(command.layout, {});
    const runtimeHealth = readRuntimeHealth(command.layout.runtimeHealthPath);
    const releaseState = readReleaseState(command.layout.releaseStatePath, runtimeHealth?.agent_version ?? command.currentConfig.AGENT_ID);
    writeReleaseState(command.layout.releaseStatePath, clearReleaseStateLocalFlags(releaseState));
    recordOperationalEvent(command.layout, {
        type: command.source === 'LOCAL' ? 'LOCAL_RESET' : 'REMOTE_RESET',
        occurredAt: new Date().toISOString(),
        source: command.source,
        message: command.source === 'LOCAL'
            ? 'Local reset cleared local overrides and local blocked versions'
            : 'Remote reset cleared local overrides and local blocked versions',
        metadata: {},
    });
    return syncAgentControlState({
        layout: command.layout,
        currentConfig: command.currentConfig,
    });
}
export async function applyRemoteCommand(command) {
    if (command.remoteCommand.type === 'RESET_AGENT') {
        const result = await executeLocalReset({
            layout: command.layout,
            currentConfig: command.currentConfig,
            source: 'REMOTE_COMMAND',
        });
        return {
            requiresRestart: true,
            result,
        };
    }
    recordOperationalEvent(command.layout, {
        type: 'REMOTE_FORCE_UPDATE',
        occurredAt: new Date().toISOString(),
        source: 'REMOTE_COMMAND',
        message: `Remote command ${command.remoteCommand.type} requested restart`,
        metadata: {
            commandId: command.remoteCommand.id,
        },
    });
    const result = await syncAgentControlState({
        layout: command.layout,
        currentConfig: command.currentConfig,
    });
    return {
        requiresRestart: true,
        result,
    };
}
