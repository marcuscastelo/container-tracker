import { execFile } from 'node:child_process';
import process from 'node:process';
const DEFAULT_LINUX_SERVICE_NAME = 'container-tracker-agent';
const DEFAULT_WINDOWS_TASK_NAME = 'ContainerTrackerAgent';
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
function resolveLinuxServiceName(command) {
    return (command?.serviceName?.trim() ||
        process.env.AGENT_SERVICE_NAME?.trim() ||
        DEFAULT_LINUX_SERVICE_NAME);
}
function resolveWindowsTaskName(command) {
    return (command?.serviceName?.trim() ||
        process.env.AGENT_WINDOWS_TASK_NAME?.trim() ||
        DEFAULT_WINDOWS_TASK_NAME);
}
export function buildWindowsTaskRunCommand(taskName) {
    return `schtasks /Run /TN "${taskName}" >NUL 2>&1`;
}
export function buildWindowsTaskEndCommand(taskName) {
    return `schtasks /End /TN "${taskName}" >NUL 2>&1 || exit /B 0`;
}
export function parseWindowsTaskQueryOutput(output) {
    const normalized = output.toLowerCase();
    if (normalized.includes('status: running') ||
        normalized.includes('scheduled task state: running')) {
        return { status: 'running', detail: output.trim() };
    }
    if (normalized.includes('status: ready') ||
        normalized.includes('status: queued') ||
        normalized.includes('scheduled task state: ready')) {
        return { status: 'stopped', detail: output.trim() };
    }
    return { status: 'unknown', detail: output.trim() };
}
async function queryLinuxService(command) {
    const serviceName = resolveLinuxServiceName(command);
    try {
        const result = await runCommand('systemctl', ['is-active', serviceName]);
        const status = result.stdout.trim().toLowerCase();
        if (status === 'active') {
            return { status: 'running', detail: result.stdout.trim() };
        }
        return { status: 'unknown', detail: result.stdout.trim() };
    }
    catch (error) {
        const detail = toErrorMessage(error);
        if (detail.toLowerCase().includes('inactive') || detail.toLowerCase().includes('unknown')) {
            return { status: 'stopped', detail };
        }
        return { status: 'unknown', detail };
    }
}
function runWindowsTaskCommand(commandLine) {
    return runCommand('cmd.exe', ['/d', '/s', '/c', commandLine]).then(() => undefined);
}
async function queryWindowsTask(command) {
    const taskName = resolveWindowsTaskName(command);
    try {
        const result = await runCommand('schtasks', ['/Query', '/TN', taskName, '/FO', 'LIST', '/V']);
        return parseWindowsTaskQueryOutput(result.stdout);
    }
    catch (error) {
        return {
            status: 'unknown',
            detail: toErrorMessage(error),
        };
    }
}
export function createLinuxLocalControlAdapter() {
    return {
        key: 'linux',
        queryAgent(command) {
            return queryLinuxService(command);
        },
        async startAgent(command) {
            await runCommand('systemctl', ['start', resolveLinuxServiceName(command)]);
        },
        async stopAgent(command) {
            await runCommand('systemctl', ['stop', resolveLinuxServiceName(command)]);
        },
        async restartAgent(command) {
            await runCommand('systemctl', ['restart', resolveLinuxServiceName(command)]);
        },
    };
}
export function createWindowsLocalControlAdapter() {
    return {
        key: 'windows',
        queryAgent(command) {
            return queryWindowsTask(command);
        },
        async startAgent(command) {
            await runWindowsTaskCommand(buildWindowsTaskRunCommand(resolveWindowsTaskName(command)));
        },
        async stopAgent(command) {
            await runWindowsTaskCommand(buildWindowsTaskEndCommand(resolveWindowsTaskName(command)));
        },
        async restartAgent(command) {
            const taskName = resolveWindowsTaskName(command);
            await runWindowsTaskCommand(buildWindowsTaskEndCommand(taskName));
            await runWindowsTaskCommand(buildWindowsTaskRunCommand(taskName));
        },
    };
}
