import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
// biome-ignore lint/style/noRestrictedImports: Canonical runtime path resolver needs direct relative imports in release bundles.
import { resolvePlatformAdapter } from "../platform/platform.adapter.js";
const LINUX_SYSTEM_DATA_DIR = '/var/lib/container-tracker-agent';
const LINUX_CONFIG_DIR = '/etc/container-tracker-agent';
const LINUX_PUBLIC_STATE_DIR = '/run/container-tracker-agent';
const DEV_FALLBACK_DIR_NAME = '.agent-runtime';
function normalizeOptionalEnv(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function canUseLinuxSystemDir(candidate) {
    try {
        fs.mkdirSync(candidate, { recursive: true });
        fs.accessSync(candidate, fs.constants.R_OK | fs.constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
}
function resolvePlatformDataDir(env) {
    return resolvePlatformAdapter().resolvePaths({ env }).dataDir;
}
function isLinuxSystemDataDir(candidate) {
    return path.resolve(candidate) === path.resolve(LINUX_SYSTEM_DATA_DIR);
}
export function resolveAgentDataDirFrom(command) {
    const dataDirFromEnv = normalizeOptionalEnv(command.env.AGENT_DATA_DIR);
    if (dataDirFromEnv) {
        return dataDirFromEnv;
    }
    if (command.platform === 'linux') {
        if (command.canUseLinuxSystemDir(LINUX_SYSTEM_DATA_DIR)) {
            return LINUX_SYSTEM_DATA_DIR;
        }
        return path.resolve(command.cwd, DEV_FALLBACK_DIR_NAME);
    }
    return command.resolvePlatformDataDir(command.env);
}
export function resolveAgentDataDir() {
    return resolveAgentDataDirFrom({
        env: process.env,
        platform: process.platform,
        cwd: process.cwd(),
        resolvePlatformDataDir,
        canUseLinuxSystemDir,
    });
}
export function resolveAgentConfigDir() {
    const configDirFromEnv = normalizeOptionalEnv(process.env.AGENT_CONFIG_DIR);
    if (configDirFromEnv) {
        return configDirFromEnv;
    }
    if (process.platform === 'linux') {
        return LINUX_CONFIG_DIR;
    }
    return resolveAgentDataDir();
}
export function resolveLogsDir() {
    return path.join(resolveAgentDataDir(), 'logs');
}
export function resolveReleaseStatePath() {
    return path.join(resolveAgentDataDir(), 'release-state.json');
}
export function resolveAgentPublicStateDir() {
    return resolveAgentPublicStateDirFrom({
        env: process.env,
        platform: process.platform,
        resolveAgentDataDir,
    });
}
export function resolveAgentPublicStateDirFrom(command) {
    const publicStateDirFromEnv = normalizeOptionalEnv(command.env.AGENT_PUBLIC_STATE_DIR);
    if (publicStateDirFromEnv) {
        return publicStateDirFromEnv;
    }
    const dataDir = command.resolveAgentDataDir();
    if (command.platform === 'linux') {
        return isLinuxSystemDataDir(dataDir) ? LINUX_PUBLIC_STATE_DIR : path.join(dataDir, 'run');
    }
    return path.join(dataDir, 'run');
}
export function resolveAgentPublicStatePath() {
    return path.join(resolveAgentPublicStateDir(), 'control-ui-state.json');
}
export function resolveAgentPublicBackendStatePath() {
    return path.join(resolveAgentPublicStateDir(), 'control-ui-backend-state.json');
}
export function resolveAgentPublicLogsPath() {
    return path.join(resolveAgentPublicStateDir(), 'control-ui-logs.json');
}
