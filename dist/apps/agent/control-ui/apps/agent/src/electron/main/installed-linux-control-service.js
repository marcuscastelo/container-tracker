import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { AgentControlBackendStateSchema, AgentControlBackendUpdateResultSchema, AgentControlCommandResultSchema, AgentControlLogsResponseSchema, } from '../../control-core/contracts.js';
import { readAgentControlPublicBackendState, readAgentControlPublicLogs, selectAgentControlPublicLogs, } from '../../control-core/public-control-files.js';
import { buildAgentControlPaths, readAgentControlPublicState, } from '../../control-core/public-control-state.js';
import { AgentControlBackendUrlInputSchema, } from '../ipc.js';
import { resolveInstalledLinuxAgentPathLayout } from '../../runtime-paths.js';
function toErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, [...args], { maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
            if (error) {
                const detail = stderr.trim() || stdout.trim() || toErrorMessage(error);
                reject(new Error(detail));
                return;
            }
            resolve({
                stdout,
                stderr,
            });
        });
    });
}
function readPublicState() {
    return readAgentControlPublicState(resolveInstalledLinuxPublicStatePath());
}
function readPublicBackendState() {
    return readAgentControlPublicBackendState(resolveInstalledLinuxPublicBackendStatePath());
}
function readPublicLogs() {
    return readAgentControlPublicLogs(resolveInstalledLinuxPublicLogsPath());
}
function normalizeOptionalEnv(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function resolveInstalledLinuxLayout() {
    return resolveInstalledLinuxAgentPathLayout();
}
function resolveInstalledLinuxPublicStateDir() {
    return normalizeOptionalEnv(process.env.AGENT_PUBLIC_STATE_DIR) || '/run/container-tracker-agent';
}
function resolveInstalledLinuxPublicStatePath() {
    return path.join(resolveInstalledLinuxPublicStateDir(), 'control-ui-state.json');
}
function resolveInstalledLinuxPublicBackendStatePath() {
    return path.join(resolveInstalledLinuxPublicStateDir(), 'control-ui-backend-state.json');
}
function resolveInstalledLinuxPublicLogsPath() {
    return path.join(resolveInstalledLinuxPublicStateDir(), 'control-ui-logs.json');
}
async function runAdminCommand(command) {
    const pkexecPath = process.env.CT_AGENT_PKEXEC_PATH?.trim() || 'pkexec';
    const adminPath = process.env.CT_AGENT_ADMIN_PATH?.trim() || '/usr/bin/ct-agent-admin';
    const args = typeof command.input === 'undefined'
        ? [adminPath, command.subcommand]
        : [adminPath, command.subcommand, JSON.stringify(command.input)];
    const { stdout } = await runCommand(pkexecPath, args);
    const normalizedStdout = stdout.trim();
    if (normalizedStdout.length === 0) {
        throw new Error(`${command.subcommand} returned no output`);
    }
    let parsedJson;
    try {
        parsedJson = JSON.parse(normalizedStdout);
    }
    catch (error) {
        throw new Error(`${command.subcommand} returned invalid JSON: ${toErrorMessage(error)}`);
    }
    return command.parser.parse(parsedJson);
}
function buildInstalledLinuxDebugPaths() {
    return buildAgentControlPaths(resolveInstalledLinuxLayout());
}
export function createInstalledLinuxControlService() {
    return {
        async getBackendState() {
            const publicBackendState = readPublicBackendState();
            if (publicBackendState) {
                return publicBackendState;
            }
            const publicState = readPublicState();
            if (publicState?.backendState) {
                return publicState.backendState;
            }
            return AgentControlBackendStateSchema.parse({
                backendUrl: null,
                source: 'NONE',
                status: 'UNCONFIGURED',
                runtimeConfigAvailable: false,
                bootstrapConfigAvailable: false,
                installerTokenAvailable: false,
                publicStateAvailable: publicState !== null,
                warnings: [
                    'Backend state has not been published by the supervisor yet. Refresh after the agent finishes booting.',
                ],
            });
        },
        async getSnapshot() {
            const publicState = readPublicState();
            if (publicState) {
                return publicState.snapshot;
            }
            if (readPublicBackendState() || readPublicLogs()) {
                throw new Error(`Waiting for the supervisor to publish the canonical control snapshot at ${resolveInstalledLinuxPublicStatePath()}.`);
            }
            throw new Error(`Agent public state unavailable at ${resolveInstalledLinuxPublicStatePath()}. Confirm the system service is running.`);
        },
        async getLogs(query) {
            const publicLogs = readPublicLogs();
            if (!publicLogs) {
                return AgentControlLogsResponseSchema.parse({
                    lines: [],
                });
            }
            const publicLogSelection = typeof query?.channel === 'undefined' && typeof query?.tail === 'undefined'
                ? undefined
                : {
                    ...(typeof query?.channel === 'undefined' ? {} : { channel: query.channel }),
                    ...(typeof query?.tail === 'undefined' ? {} : { tail: query.tail }),
                };
            return selectAgentControlPublicLogs(publicLogs, publicLogSelection);
        },
        async getReleaseInventory() {
            const publicState = readPublicState();
            if (publicState) {
                return publicState.releaseInventory;
            }
            return {
                releases: [],
            };
        },
        async getPaths() {
            const publicState = readPublicState();
            if (publicState) {
                return publicState.paths;
            }
            return buildInstalledLinuxDebugPaths();
        },
        async startAgent() {
            return runAdminCommand({
                subcommand: 'start-agent',
                parser: AgentControlCommandResultSchema,
            });
        },
        async stopAgent() {
            return runAdminCommand({
                subcommand: 'stop-agent',
                parser: AgentControlCommandResultSchema,
            });
        },
        async restartAgent() {
            return runAdminCommand({
                subcommand: 'restart-agent',
                parser: AgentControlCommandResultSchema,
            });
        },
        async pauseUpdates() {
            return runAdminCommand({
                subcommand: 'pause-updates',
                parser: AgentControlCommandResultSchema,
            });
        },
        async resumeUpdates() {
            return runAdminCommand({
                subcommand: 'resume-updates',
                parser: AgentControlCommandResultSchema,
            });
        },
        async changeChannel(input) {
            return runAdminCommand({
                subcommand: 'change-channel',
                input,
                parser: AgentControlCommandResultSchema,
            });
        },
        async setBlockedVersions(input) {
            return runAdminCommand({
                subcommand: 'set-blocked-versions',
                input,
                parser: AgentControlCommandResultSchema,
            });
        },
        async updateConfig(input) {
            return runAdminCommand({
                subcommand: 'update-config',
                input,
                parser: AgentControlCommandResultSchema,
            });
        },
        async setBackendUrl(backendUrl) {
            const input = AgentControlBackendUrlInputSchema.parse({ backendUrl });
            return runAdminCommand({
                subcommand: 'set-backend-url',
                input,
                parser: AgentControlBackendUpdateResultSchema,
            });
        },
        async activateRelease(input) {
            return runAdminCommand({
                subcommand: 'activate-release',
                input,
                parser: AgentControlCommandResultSchema,
            });
        },
        async rollbackRelease() {
            return runAdminCommand({
                subcommand: 'rollback-release',
                parser: AgentControlCommandResultSchema,
            });
        },
        async executeLocalReset() {
            return runAdminCommand({
                subcommand: 'execute-local-reset',
                parser: AgentControlCommandResultSchema,
            });
        },
    };
}
