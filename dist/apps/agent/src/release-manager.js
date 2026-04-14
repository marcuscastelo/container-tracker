import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const RELEASE_ENTRYPOINT_CANDIDATES = [
    path.join('dist', 'apps', 'agent', 'src', 'agent.js'),
    path.join('app', 'dist', 'apps', 'agent', 'src', 'agent.js'),
    path.join('dist', 'agent.js'),
    path.join('app', 'dist', 'agent.js'),
    'agent.js',
];
const SUPERVISOR_SHIM_IMPORT_PATTERN = /^\s*import\s+['"]\.\/apps\/agent\/src\/supervisor\.js['"];?\s*$/mu;
export function sanitizeVersionForPath(version) {
    const trimmed = version.trim();
    if (trimmed.length === 0) {
        throw new Error('release version cannot be empty');
    }
    return trimmed.replace(/[^a-zA-Z0-9._-]/gu, '_');
}
export function resolveReleaseDir(releasesDir, version) {
    return path.join(releasesDir, sanitizeVersionForPath(version));
}
function pathExists(targetPath) {
    try {
        fs.lstatSync(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
function removePathIfExists(targetPath) {
    if (!pathExists(targetPath)) {
        return;
    }
    fs.rmSync(targetPath, { recursive: true, force: true });
}
function createOrReplaceDirectoryLink(command) {
    removePathIfExists(command.linkPath);
    const linkType = process.platform === 'win32' ? 'junction' : 'dir';
    fs.symlinkSync(command.targetPath, command.linkPath, linkType);
}
function safeRealpath(targetPath) {
    try {
        return fs.realpathSync(targetPath);
    }
    catch {
        return null;
    }
}
function basenameFromPath(targetPath) {
    if (!targetPath) {
        return null;
    }
    const base = path.basename(targetPath);
    return base.length > 0 ? base : null;
}
function normalizePathForComparison(targetPath) {
    const resolved = path.resolve(targetPath);
    if (process.platform === 'win32') {
        return resolved.toLowerCase();
    }
    return resolved;
}
function arePathsEqual(leftPath, rightPath) {
    return normalizePathForComparison(leftPath) === normalizePathForComparison(rightPath);
}
function isPathWithinDirectory(directoryPath, candidatePath) {
    const normalizedDirectory = normalizePathForComparison(directoryPath);
    const normalizedCandidate = normalizePathForComparison(candidatePath);
    const relativePath = path.relative(normalizedDirectory, normalizedCandidate);
    if (relativePath.length === 0) {
        return true;
    }
    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}
function removeInvalidCurrentRelease(layout, linkedReleasePath) {
    removePathIfExists(layout.currentLinkPath);
    const previousLinkedReleasePath = safeRealpath(layout.previousLinkPath);
    if (previousLinkedReleasePath && arePathsEqual(previousLinkedReleasePath, linkedReleasePath)) {
        removePathIfExists(layout.previousLinkPath);
    }
    if (isPathWithinDirectory(layout.releasesDir, linkedReleasePath)) {
        removePathIfExists(linkedReleasePath);
    }
}
function isSupervisorShimEntrypoint(entrypointPath) {
    if (path.basename(entrypointPath).toLowerCase() !== 'agent.js') {
        return false;
    }
    try {
        const content = fs.readFileSync(entrypointPath, 'utf8');
        return SUPERVISOR_SHIM_IMPORT_PATTERN.test(content);
    }
    catch {
        return false;
    }
}
export function resolveReleaseEntrypoint(releaseDir) {
    for (const candidate of RELEASE_ENTRYPOINT_CANDIDATES) {
        const fullPath = path.join(releaseDir, candidate);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            if (isSupervisorShimEntrypoint(fullPath)) {
                continue;
            }
            return fullPath;
        }
    }
    return null;
}
export function resolveRuntimeEntrypoint(command) {
    const linkedReleasePath = safeRealpath(command.layout.currentLinkPath);
    if (linkedReleasePath) {
        const releaseEntrypoint = resolveReleaseEntrypoint(linkedReleasePath);
        if (releaseEntrypoint) {
            const linkedVersion = basenameFromPath(linkedReleasePath) ?? command.expectedVersion;
            return {
                version: linkedVersion,
                entrypointPath: releaseEntrypoint,
                source: 'release',
            };
        }
        removeInvalidCurrentRelease(command.layout, linkedReleasePath);
    }
    return {
        version: command.expectedVersion,
        entrypointPath: command.fallbackEntrypoint,
        source: 'fallback',
    };
}
export function ensureReleaseLinksForCurrentState(command) {
    const currentDir = resolveReleaseDir(command.layout.releasesDir, command.state.current_version);
    if (!pathExists(currentDir)) {
        return;
    }
    const currentRealPath = safeRealpath(command.layout.currentLinkPath);
    if (currentRealPath !== currentDir) {
        createOrReplaceDirectoryLink({
            linkPath: command.layout.currentLinkPath,
            targetPath: currentDir,
        });
    }
    if (command.state.previous_version) {
        const previousDir = resolveReleaseDir(command.layout.releasesDir, command.state.previous_version);
        if (pathExists(previousDir)) {
            const previousRealPath = safeRealpath(command.layout.previousLinkPath);
            if (previousRealPath !== previousDir) {
                createOrReplaceDirectoryLink({
                    linkPath: command.layout.previousLinkPath,
                    targetPath: previousDir,
                });
            }
        }
    }
}
export function activateTargetRelease(command) {
    const targetDir = resolveReleaseDir(command.layout.releasesDir, command.targetVersion);
    if (!pathExists(targetDir)) {
        throw new Error(`target release is missing: ${targetDir}`);
    }
    const targetEntrypoint = resolveReleaseEntrypoint(targetDir);
    if (!targetEntrypoint) {
        throw new Error(`target release has no valid entrypoint: ${targetDir}`);
    }
    const currentRealPath = safeRealpath(command.layout.currentLinkPath);
    const previousVersionFromLink = basenameFromPath(currentRealPath);
    if (currentRealPath) {
        createOrReplaceDirectoryLink({
            linkPath: command.layout.previousLinkPath,
            targetPath: currentRealPath,
        });
    }
    createOrReplaceDirectoryLink({
        linkPath: command.layout.currentLinkPath,
        targetPath: targetDir,
    });
    return {
        ...command.state,
        previous_version: previousVersionFromLink ?? command.state.current_version,
        current_version: command.targetVersion,
        target_version: command.targetVersion,
        activation_state: 'verifying',
        last_update_attempt: command.nowIso,
        last_error: null,
    };
}
export function confirmRelease(command) {
    const activationFailures = { ...command.state.activation_failures };
    delete activationFailures[command.confirmedVersion];
    return {
        ...command.state,
        current_version: command.confirmedVersion,
        previous_version: command.state.previous_version ?? command.state.last_known_good_version,
        last_known_good_version: command.confirmedVersion,
        target_version: null,
        activation_state: 'idle',
        failure_count: 0,
        activation_failures: activationFailures,
        last_update_attempt: command.nowIso,
        last_error: null,
    };
}
export function rollbackRelease(command) {
    const rollbackDir = resolveReleaseDir(command.layout.releasesDir, command.rollbackVersion);
    if (pathExists(rollbackDir)) {
        createOrReplaceDirectoryLink({
            linkPath: command.layout.currentLinkPath,
            targetPath: rollbackDir,
        });
    }
    else {
        removePathIfExists(command.layout.currentLinkPath);
        removePathIfExists(command.layout.previousLinkPath);
    }
    return {
        ...command.state,
        current_version: command.rollbackVersion,
        last_known_good_version: command.rollbackVersion,
        target_version: null,
        activation_state: 'rolled_back',
        last_update_attempt: command.nowIso,
        last_error: command.reason,
    };
}
