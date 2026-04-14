import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { ControlRuntimeConfigSchema, executeLocalReset, readCurrentControlRuntimeConfig, recordOperationalEvent, serializeRuntimeConfig, setLocalBlockedVersions, setLocalChannel, setLocalUpdatesPaused, syncAgentControlState, updateLocalEditableConfig, } from './agent-control-core.js';
import { AgentControlBackendStateSchema, AgentControlBackendUpdateResultSchema, AgentControlCommandResultSchema, AgentControlLogChannelSchema, AgentControlLogsResponseSchema, } from './contracts.js';
import { buildAgentControlPaths, buildAgentReleaseInventory, readAgentControlPublicState, } from './public-control-state.js';
import { resolvePlatformAdapter } from '../platform/platform.adapter.js';
import { resolveReleaseEntrypoint, rollbackRelease as rollbackReleaseState, } from '../release-manager.js';
import { readReleaseState, writeReleaseState } from '../release-state.js';
import { resolveAgentPublicBackendStatePath, resolveAgentPublicStatePath, } from '../runtime/paths.js';
import { writeSupervisorControl } from '../supervisor-control.js';
const LOG_FILE_BY_CHANNEL = {
    stdout: 'agent.out.log',
    stderr: 'agent.err.log',
    supervisor: 'supervisor.log',
    updater: 'updater.log',
};
function resolveLocalControlAdapter() {
    return resolvePlatformAdapter().control;
}
function writeFileAtomic(filePath, content) {
    const parentDir = path.dirname(filePath);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
}
function normalizeOptionalString(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
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
    return {
        key: trimmed.slice(0, separatorIndex).trim(),
        value: trimmed.slice(separatorIndex + 1).trim(),
    };
}
function readEnvFileValues(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const values = new Map();
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/u)) {
        const parsed = parseEnvLine(line);
        if (!parsed) {
            continue;
        }
        values.set(parsed.key, parsed.value);
    }
    return values;
}
function normalizeBackendUrl(value) {
    const trimmed = value.trim();
    const url = new URL(trimmed);
    return url.toString().replace(/\/+$/u, '');
}
function readBackendUrlFromEnvFile(filePath) {
    const values = readEnvFileValues(filePath);
    if (!values) {
        return null;
    }
    const backendUrl = normalizeOptionalString(values.get('BACKEND_URL'));
    if (!backendUrl) {
        return null;
    }
    try {
        return normalizeBackendUrl(backendUrl);
    }
    catch {
        return null;
    }
}
function hasInstallerToken(filePath) {
    const values = readEnvFileValues(filePath);
    if (!values) {
        return false;
    }
    const installerToken = normalizeOptionalString(values.get('INSTALLER_TOKEN'));
    return installerToken !== null && installerToken !== '[REDACTED]';
}
function upsertEnvFileValue(command) {
    if (!fs.existsSync(command.filePath)) {
        if (command.createIfMissing !== true) {
            return false;
        }
        writeFileAtomic(command.filePath, `${command.key}=${command.value}\n`);
        return true;
    }
    const lines = fs.readFileSync(command.filePath, 'utf8').split(/\r?\n/u);
    let replaced = false;
    const nextLines = lines.map((line) => {
        const parsed = parseEnvLine(line);
        if (!parsed || parsed.key !== command.key) {
            return line;
        }
        replaced = true;
        return `${command.key}=${command.value}`;
    });
    if (!replaced) {
        const insertionIndex = nextLines.at(-1) === '' ? nextLines.length - 1 : nextLines.length;
        nextLines.splice(insertionIndex, 0, `${command.key}=${command.value}`);
    }
    writeFileAtomic(command.filePath, `${nextLines.join('\n')}\n`);
    return true;
}
function clearPublicStateFiles() {
    try {
        fs.rmSync(resolveAgentPublicStatePath(), { force: true });
    }
    catch {
        // Ignore stale public state cleanup failures.
    }
    try {
        fs.rmSync(resolveAgentPublicBackendStatePath(), { force: true });
    }
    catch {
        // Ignore stale public backend-state cleanup failures.
    }
}
function invalidateRemoteCaches(layout) {
    for (const cachePath of [layout.controlRemoteCachePath, layout.infraConfigPath]) {
        try {
            fs.rmSync(cachePath, { force: true });
        }
        catch {
            // Ignore cache cleanup failures and keep command best-effort.
        }
    }
}
export function readAgentControlBackendState(layout) {
    const publicStateAvailable = readAgentControlPublicState(resolveAgentPublicStatePath()) !== null;
    const runtimeConfigMaterialized = fs.existsSync(layout.configPath);
    const baseRuntimeConfigAvailable = fs.existsSync(layout.baseRuntimeConfigPath);
    const runtimeConfigAvailable = readCurrentControlRuntimeConfig(layout) !== null &&
        (runtimeConfigMaterialized || baseRuntimeConfigAvailable);
    const currentConfig = readCurrentControlRuntimeConfig(layout);
    const bootstrapConfigAvailable = fs.existsSync(layout.bootstrapPath);
    const consumedBootstrapAvailable = fs.existsSync(layout.consumedBootstrapPath);
    const installerTokenAvailable = hasInstallerToken(layout.bootstrapPath);
    const bootstrapBackendUrl = readBackendUrlFromEnvFile(layout.bootstrapPath);
    const consumedBootstrapBackendUrl = readBackendUrlFromEnvFile(layout.consumedBootstrapPath);
    let backendUrl = null;
    let source = 'NONE';
    if (currentConfig && runtimeConfigMaterialized) {
        backendUrl = currentConfig.BACKEND_URL;
        source = 'RUNTIME_CONFIG';
    }
    else if (bootstrapBackendUrl) {
        backendUrl = bootstrapBackendUrl;
        source = 'BOOTSTRAP';
    }
    else if (consumedBootstrapBackendUrl) {
        backendUrl = consumedBootstrapBackendUrl;
        source = 'CONSUMED_BOOTSTRAP';
    }
    else if (currentConfig) {
        backendUrl = currentConfig.BACKEND_URL;
        source = 'BASE_RUNTIME_CONFIG';
    }
    let status = 'UNCONFIGURED';
    if (runtimeConfigAvailable) {
        status = 'ENROLLED';
    }
    else if (bootstrapConfigAvailable || consumedBootstrapAvailable) {
        status = 'BOOTSTRAP_ONLY';
    }
    const warnings = [];
    if (!runtimeConfigAvailable && !installerTokenAvailable) {
        warnings.push('No installer token is available in bootstrap.env. A valid bootstrap file is required before the agent can enroll.');
    }
    else if (runtimeConfigAvailable && !installerTokenAvailable) {
        warnings.push('This agent is already enrolled. Switching to a different backend may require a fresh bootstrap token if the current agent token is rejected.');
    }
    return AgentControlBackendStateSchema.parse({
        backendUrl,
        source,
        status,
        runtimeConfigAvailable,
        bootstrapConfigAvailable,
        installerTokenAvailable,
        publicStateAvailable,
        warnings,
    });
}
function requireCurrentConfig(layout) {
    const config = readCurrentControlRuntimeConfig(layout);
    if (!config) {
        throw new Error(`Agent runtime config is unavailable at ${layout.configPath}`);
    }
    return config;
}
async function syncSnapshot(layout) {
    return syncAgentControlState({
        layout,
        currentConfig: requireCurrentConfig(layout),
    });
}
function listReleaseInventory(layout) {
    const currentConfig = readCurrentControlRuntimeConfig(layout);
    const state = readReleaseState(layout.releaseStatePath, currentConfig?.AGENT_ID ?? 'unknown');
    return buildAgentReleaseInventory({
        layout,
        releaseState: state,
    });
}
function readLogLines(filePath, channel, tail) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const rawLines = content.split(/\r?\n/u).filter((line) => line.length > 0);
    const startIndex = Math.max(0, rawLines.length - tail);
    return rawLines.slice(startIndex).map((message, index) => ({
        channel,
        message,
        filePath,
        lineNumber: startIndex + index + 1,
    }));
}
function readLogs(layout, command) {
    const parsedChannel = AgentControlLogChannelSchema.parse(command?.channel ?? 'all');
    const tail = Math.max(1, Math.min(command?.tail ?? 200, 2000));
    const channels = parsedChannel === 'all' ? ['stdout', 'stderr', 'supervisor', 'updater'] : [parsedChannel];
    const lines = channels.flatMap((channel) => readLogLines(path.join(layout.logsDir, LOG_FILE_BY_CHANNEL[channel]), channel, tail));
    return AgentControlLogsResponseSchema.parse({
        lines,
    });
}
function getPaths(layout) {
    return buildAgentControlPaths(layout);
}
async function withSnapshotResult(layout, message) {
    const result = await syncSnapshot(layout);
    return AgentControlCommandResultSchema.parse({
        ok: true,
        message,
        snapshot: result.snapshot,
    });
}
export function createAgentControlLocalService(deps) {
    const adapter = deps.adapter ?? resolveLocalControlAdapter();
    return {
        getAgentOperationalSnapshot() {
            return syncSnapshot(deps.layout);
        },
        getBackendState() {
            return readAgentControlBackendState(deps.layout);
        },
        getLogs(command) {
            return readLogs(deps.layout, command);
        },
        getReleaseInventory() {
            return listReleaseInventory(deps.layout);
        },
        getPaths() {
            return getPaths(deps.layout);
        },
        async startAgent() {
            await adapter.startAgent();
            return withSnapshotResult(deps.layout, 'Agent start requested');
        },
        async stopAgent() {
            await adapter.stopAgent();
            return withSnapshotResult(deps.layout, 'Agent stop requested');
        },
        async restartAgent() {
            await adapter.restartAgent();
            return withSnapshotResult(deps.layout, 'Agent restart requested');
        },
        async pauseUpdates() {
            setLocalUpdatesPaused({
                layout: deps.layout,
                paused: true,
            });
            return withSnapshotResult(deps.layout, 'Local update pause enabled');
        },
        async resumeUpdates() {
            setLocalUpdatesPaused({
                layout: deps.layout,
                paused: false,
            });
            return withSnapshotResult(deps.layout, 'Local update pause cleared');
        },
        async changeChannel(channel) {
            setLocalChannel({
                layout: deps.layout,
                channel,
            });
            return withSnapshotResult(deps.layout, channel ? `Local update channel set to ${channel}` : 'Local update channel reset to base');
        },
        async setBlockedVersions(versions) {
            setLocalBlockedVersions({
                layout: deps.layout,
                blockedVersions: versions,
            });
            return withSnapshotResult(deps.layout, 'Local blocked versions updated');
        },
        async updateConfig(patch) {
            updateLocalEditableConfig({
                layout: deps.layout,
                patch,
            });
            return withSnapshotResult(deps.layout, 'Local editable config updated');
        },
        async setBackendUrl(backendUrl) {
            const normalizedBackendUrl = normalizeBackendUrl(backendUrl);
            const currentConfig = readCurrentControlRuntimeConfig(deps.layout);
            const runtimeConfigMaterialized = fs.existsSync(deps.layout.configPath);
            let updated = false;
            if (currentConfig) {
                const nextConfig = ControlRuntimeConfigSchema.parse({
                    ...currentConfig,
                    BACKEND_URL: normalizedBackendUrl,
                });
                writeFileAtomic(deps.layout.baseRuntimeConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`);
                if (runtimeConfigMaterialized) {
                    writeFileAtomic(deps.layout.configPath, serializeRuntimeConfig(nextConfig));
                }
                updated = true;
            }
            if (upsertEnvFileValue({
                filePath: deps.layout.bootstrapPath,
                key: 'BACKEND_URL',
                value: normalizedBackendUrl,
                createIfMissing: !runtimeConfigMaterialized,
            })) {
                updated = true;
            }
            else if (upsertEnvFileValue({
                filePath: deps.layout.consumedBootstrapPath,
                key: 'BACKEND_URL',
                value: normalizedBackendUrl,
            })) {
                updated = true;
            }
            if (!updated) {
                throw new Error(`No runtime or bootstrap configuration is available to store BACKEND_URL under ${deps.layout.dataDir}`);
            }
            invalidateRemoteCaches(deps.layout);
            clearPublicStateFiles();
            recordOperationalEvent(deps.layout, {
                type: 'CONFIG_UPDATED',
                occurredAt: new Date().toISOString(),
                source: 'LOCAL',
                message: `Backend URL updated to ${normalizedBackendUrl}`,
                metadata: {
                    backendUrl: normalizedBackendUrl,
                },
            });
            await adapter.restartAgent();
            return AgentControlBackendUpdateResultSchema.parse({
                ok: true,
                message: `Backend URL updated to ${normalizedBackendUrl} and service restart requested`,
                state: readAgentControlBackendState(deps.layout),
            });
        },
        async activateRelease(version) {
            const syncResult = await syncSnapshot(deps.layout);
            const releaseDir = path.join(deps.layout.releasesDir, version);
            if (!fs.existsSync(releaseDir)) {
                throw new Error(`Release ${version} is not installed`);
            }
            if (!resolveReleaseEntrypoint(releaseDir)) {
                throw new Error(`Release ${version} has no executable entrypoint`);
            }
            if (syncResult.snapshot.updates.blockedVersions.effective.includes(version)) {
                throw new Error(`Release ${version} is blocked by effective policy`);
            }
            const nowIso = new Date().toISOString();
            writeReleaseState(deps.layout.releaseStatePath, {
                ...syncResult.releaseState,
                target_version: version,
                activation_state: 'pending',
                last_update_attempt: nowIso,
                last_error: null,
                automatic_updates_blocked: false,
            });
            writeSupervisorControl(deps.layout.supervisorControlPath, {
                drain_requested: true,
                reason: 'update',
                requested_at: nowIso,
            });
            recordOperationalEvent(deps.layout, {
                type: 'RELEASE_ACTIVATED',
                occurredAt: nowIso,
                source: 'LOCAL',
                message: `Release ${version} marked for activation`,
                metadata: {
                    version,
                },
            });
            return withSnapshotResult(deps.layout, `Release ${version} marked for activation`);
        },
        async rollbackRelease() {
            const currentConfig = requireCurrentConfig(deps.layout);
            const state = readReleaseState(deps.layout.releaseStatePath, currentConfig.AGENT_ID);
            const rollbackVersion = state.previous_version ?? state.last_known_good_version;
            if (!rollbackVersion || rollbackVersion === state.current_version) {
                throw new Error('No rollback target is available');
            }
            const nowIso = new Date().toISOString();
            const rolledBackState = rollbackReleaseState({
                layout: deps.layout,
                state,
                rollbackVersion,
                nowIso,
                reason: 'manual rollback requested from local control UI',
            });
            writeReleaseState(deps.layout.releaseStatePath, rolledBackState);
            writeSupervisorControl(deps.layout.supervisorControlPath, {
                drain_requested: true,
                reason: 'manual',
                requested_at: nowIso,
            });
            recordOperationalEvent(deps.layout, {
                type: 'ROLLBACK_EXECUTED',
                occurredAt: nowIso,
                source: 'LOCAL',
                message: `Rollback executed to ${rollbackVersion}`,
                metadata: {
                    rollbackVersion,
                },
            });
            return withSnapshotResult(deps.layout, `Rollback executed to ${rollbackVersion}`);
        },
        async executeLocalReset() {
            try {
                await adapter.stopAgent();
            }
            catch {
                // Reset must still proceed when the service is already stopped or unavailable.
            }
            const result = await executeLocalReset({
                layout: deps.layout,
                currentConfig: requireCurrentConfig(deps.layout),
                source: 'LOCAL',
            });
            await adapter.startAgent();
            return AgentControlCommandResultSchema.parse({
                ok: true,
                message: 'Local reset executed and runtime restart requested',
                snapshot: result.snapshot,
            });
        },
    };
}
