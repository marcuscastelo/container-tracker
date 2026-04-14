// biome-ignore-all lint/style/noRestrictedImports: Runtime shim keeps direct relative imports for release bundles.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveAgentConfigDir as resolveCanonicalAgentConfigDir, resolveAgentDataDir as resolveCanonicalAgentDataDir, resolveLogsDir as resolveCanonicalLogsDir, resolveReleaseStatePath as resolveCanonicalReleaseStatePath, } from "../runtime/paths.js";
const INSTALLED_LINUX_DATA_DIR = '/var/lib/container-tracker-agent';
function normalizeOptionalEnv(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function toAgentPathLayout(dataDir) {
    const configPath = normalizeOptionalEnv(process.env.DOTENV_PATH) ?? path.join(dataDir, 'config.env');
    const bootstrapPath = normalizeOptionalEnv(process.env.BOOTSTRAP_DOTENV_PATH) ?? path.join(dataDir, 'bootstrap.env');
    return {
        dataDir,
        configPath,
        baseRuntimeConfigPath: path.join(dataDir, 'control-base.runtime.json'),
        bootstrapPath,
        consumedBootstrapPath: `${bootstrapPath}.consumed`,
        releasesDir: resolveReleasesDir(dataDir),
        downloadsDir: path.join(dataDir, 'downloads'),
        logsDir: path.join(dataDir, 'logs'),
        currentLinkPath: path.join(dataDir, 'current'),
        previousLinkPath: path.join(dataDir, 'previous'),
        releaseStatePath: path.join(dataDir, 'release-state.json'),
        runtimeHealthPath: path.join(dataDir, 'runtime-health.json'),
        supervisorControlPath: path.join(dataDir, 'supervisor-control.json'),
        pendingActivityPath: path.join(dataDir, 'pending-activity-events.json'),
        controlOverridesPath: path.join(dataDir, 'control-overrides.local.json'),
        controlRemoteCachePath: path.join(dataDir, 'control-remote-cache.json'),
        infraConfigPath: path.join(dataDir, 'infra-config.json'),
        auditLogPath: path.join(dataDir, 'agent-control-audit.ndjson'),
    };
}
export function resolveDataDir() {
    return resolveCanonicalAgentDataDir();
}
export function resolveAgentConfigDir() {
    return resolveCanonicalAgentConfigDir();
}
export function resolveAgentDataDir() {
    return resolveCanonicalAgentDataDir();
}
export function resolveLogsDir() {
    return resolveCanonicalLogsDir();
}
export function resolveReleaseStatePath() {
    return resolveCanonicalReleaseStatePath();
}
export function resolveReleasesDir(dataDir) {
    return path.join(dataDir, 'releases');
}
export function resolveCurrentRelease(currentLinkPath) {
    try {
        return fs.realpathSync(currentLinkPath);
    }
    catch {
        return null;
    }
}
export function resolveAgentPathLayout() {
    return toAgentPathLayout(resolveDataDir());
}
export function resolveInstalledLinuxAgentPathLayout() {
    const dataDir = normalizeOptionalEnv(process.env.AGENT_DATA_DIR) ?? INSTALLED_LINUX_DATA_DIR;
    return toAgentPathLayout(dataDir);
}
export function ensureAgentPathLayout(layout) {
    fs.mkdirSync(layout.dataDir, { recursive: true });
    fs.mkdirSync(layout.releasesDir, { recursive: true });
    fs.mkdirSync(layout.downloadsDir, { recursive: true });
    fs.mkdirSync(layout.logsDir, { recursive: true });
}
