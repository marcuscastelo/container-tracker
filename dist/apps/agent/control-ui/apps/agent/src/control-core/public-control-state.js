import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { AgentControlPathsSchema, AgentControlPublicStateSchema, AgentReleaseInventorySchema, } from './contracts.js';
import { resolveReleaseEntrypoint } from '../release-manager.js';
function writeFileAtomic(filePath, content) {
    const parentDir = path.dirname(filePath);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
}
export function buildAgentControlPaths(layout) {
    return AgentControlPathsSchema.parse({
        dataDir: layout.dataDir,
        configPath: layout.configPath,
        releasesDir: layout.releasesDir,
        logsDir: layout.logsDir,
        releaseStatePath: layout.releaseStatePath,
        runtimeHealthPath: layout.runtimeHealthPath,
        supervisorControlPath: layout.supervisorControlPath,
        controlOverridesPath: layout.controlOverridesPath,
        controlRemoteCachePath: layout.controlRemoteCachePath,
        infraConfigPath: layout.infraConfigPath,
        auditLogPath: layout.auditLogPath,
    });
}
export function buildAgentReleaseInventory(command) {
    const entries = fs.existsSync(command.layout.releasesDir)
        ? fs
            .readdirSync(command.layout.releasesDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
        : [];
    return AgentReleaseInventorySchema.parse({
        releases: [...entries]
            .sort((left, right) => right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }))
            .map((version) => {
            const releaseDir = path.join(command.layout.releasesDir, version);
            return {
                version,
                isCurrent: command.releaseState.current_version === version,
                isPrevious: command.releaseState.previous_version === version,
                isTarget: command.releaseState.target_version === version,
                entrypointPath: resolveReleaseEntrypoint(releaseDir),
            };
        }),
    });
}
export function writeAgentControlPublicState(command) {
    const state = AgentControlPublicStateSchema.parse({
        snapshot: command.snapshot,
        releaseInventory: command.releaseInventory,
        paths: command.paths,
        backendState: command.backendState,
    });
    writeFileAtomic(command.filePath, `${JSON.stringify(state, null, 2)}\n`);
    fs.chmodSync(command.filePath, 0o644);
    return state;
}
export function readAgentControlPublicState(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const normalized = AgentControlPublicStateSchema.safeParse(parsed);
        if (!normalized.success) {
            return null;
        }
        return normalized.data;
    }
    catch {
        return null;
    }
}
