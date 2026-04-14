import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod/v4';
const activationStateSchema = z.enum(['idle', 'pending', 'verifying', 'rolled_back', 'blocked']);
const releaseFailureEntrySchema = z.object({
    version: z.string().min(1),
    occurred_at: z.string().datetime({ offset: true }),
});
const activationFailuresSchema = z.record(z.string().min(1), z.number().int().min(0)).default({});
const releaseStateSchema = z.object({
    current_version: z.string().min(1),
    previous_version: z.string().min(1).nullable(),
    last_known_good_version: z.string().min(1),
    target_version: z.string().min(1).nullable(),
    activation_state: activationStateSchema,
    failure_count: z.number().int().min(0),
    last_update_attempt: z.string().datetime({ offset: true }).nullable(),
    blocked_versions: z.array(z.string().min(1)).default([]),
    automatic_updates_blocked: z.boolean().default(false),
    recent_failures: z.array(releaseFailureEntrySchema).default([]),
    activation_failures: activationFailuresSchema,
    last_error: z.string().nullable().default(null),
});
function writeFileAtomic(filePath, content) {
    const parentDir = path.dirname(filePath);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
}
export function createInitialReleaseState(currentVersion) {
    return {
        current_version: currentVersion,
        previous_version: null,
        last_known_good_version: currentVersion,
        target_version: null,
        activation_state: 'idle',
        failure_count: 0,
        last_update_attempt: null,
        blocked_versions: [],
        automatic_updates_blocked: false,
        recent_failures: [],
        activation_failures: {},
        last_error: null,
    };
}
function migrateReleaseState(state) {
    const hasLegacyCrashLoopBlock = state.activation_state === 'blocked' ||
        state.last_error === 'automatic updates are blocked due to previous crash loop';
    if (!state.automatic_updates_blocked || !hasLegacyCrashLoopBlock) {
        return state;
    }
    return {
        ...state,
        automatic_updates_blocked: false,
        activation_state: state.activation_state === 'blocked' ? 'idle' : state.activation_state,
        last_error: state.last_error ??
            `version ${state.blocked_versions.at(-1) ?? 'unknown'} blocked after crash loop`,
    };
}
function parseRawState(raw, fallbackVersion) {
    const parsedJson = JSON.parse(raw);
    const parsedState = releaseStateSchema.safeParse(parsedJson);
    if (parsedState.success) {
        return migrateReleaseState(parsedState.data);
    }
    return createInitialReleaseState(fallbackVersion);
}
export function writeReleaseState(filePath, state) {
    const normalized = releaseStateSchema.parse(state);
    writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
}
export function readReleaseState(filePath, fallbackVersion) {
    if (!fs.existsSync(filePath)) {
        const initialState = createInitialReleaseState(fallbackVersion);
        writeReleaseState(filePath, initialState);
        return initialState;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = parseRawState(raw, fallbackVersion);
        writeReleaseState(filePath, parsed);
        return parsed;
    }
    catch {
        const fallbackState = createInitialReleaseState(fallbackVersion);
        writeReleaseState(filePath, fallbackState);
        return fallbackState;
    }
}
export function hasBlockedVersion(state, version) {
    return state.blocked_versions.includes(version);
}
export function withRecordedFailure(command) {
    const nowMs = new Date(command.nowIso).getTime();
    const windowStartMs = nowMs - command.crashLoopWindowMs;
    const inWindow = command.state.recent_failures.filter((entry) => {
        const occurredAtMs = new Date(entry.occurred_at).getTime();
        if (Number.isNaN(occurredAtMs)) {
            return false;
        }
        return occurredAtMs >= windowStartMs;
    });
    const failures = [...inWindow, { version: command.version, occurred_at: command.nowIso }];
    const failuresForVersion = failures.filter((entry) => entry.version === command.version).length;
    const crashLoopDetected = failuresForVersion >= command.crashLoopThreshold;
    const currentActivationFailures = command.state.activation_failures[command.version] ?? 0;
    const activationFailuresForVersion = currentActivationFailures + 1;
    const activationFailures = {
        ...command.state.activation_failures,
        [command.version]: activationFailuresForVersion,
    };
    const activationFailureLimitReached = activationFailuresForVersion >= command.maxActivationFailures;
    const blockedVersions = crashLoopDetected || activationFailureLimitReached
        ? [...new Set([...command.state.blocked_versions, command.version])]
        : [...command.state.blocked_versions];
    const versionBlocked = blockedVersions.includes(command.version);
    const newlyBlocked = versionBlocked && !command.state.blocked_versions.includes(command.version);
    return {
        nextState: {
            ...command.state,
            failure_count: command.state.failure_count + 1,
            recent_failures: failures,
            activation_failures: activationFailures,
            blocked_versions: blockedVersions,
            automatic_updates_blocked: command.state.automatic_updates_blocked,
            activation_state: command.state.activation_state,
        },
        isCrashLoop: crashLoopDetected,
        activationFailuresForVersion,
        versionBlocked,
        newlyBlocked,
    };
}
