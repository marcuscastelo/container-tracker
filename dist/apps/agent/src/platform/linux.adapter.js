import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { ensureDirectory, runCommand, tryCommand } from '@agent/platform/common';
import { createLinuxLocalControlAdapter } from '@agent/platform/local-control.adapter';
const DEFAULT_DATA_DIR_NAME = 'ContainerTracker';
function normalizeOptionalEnv(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}
function resolveDataDir(env) {
    const xdgDataHome = normalizeOptionalEnv(env.XDG_DATA_HOME);
    if (xdgDataHome) {
        return path.join(xdgDataHome, DEFAULT_DATA_DIR_NAME);
    }
    return path.join(os.homedir(), '.local', 'share', DEFAULT_DATA_DIR_NAME);
}
function extractArchive(command) {
    ensureDirectory(command.destinationDir);
    if (command.archiveKind === 'zip') {
        if (tryCommand('unzip', ['-oq', command.archivePath, '-d', command.destinationDir])) {
            return;
        }
        runCommand('tar', ['-xf', command.archivePath, '-C', command.destinationDir]);
        return;
    }
    if (command.archiveKind === 'tgz') {
        runCommand('tar', ['-xzf', command.archivePath, '-C', command.destinationDir]);
        return;
    }
    runCommand('tar', ['-xf', command.archivePath, '-C', command.destinationDir]);
}
export const linuxPlatformAdapter = {
    key: 'linux-x64',
    control: createLinuxLocalControlAdapter(),
    resolvePaths(command) {
        return {
            dataDir: resolveDataDir(command.env),
        };
    },
    startRuntime(command) {
        return spawn(process.execPath, [...(command.execArgv ?? []), command.scriptPath], {
            env: command.env,
            stdio: command.stdio,
            shell: false,
        });
    },
    stopRuntime(command) {
        command.child.kill('SIGTERM');
    },
    restartRuntime(command) {
        command.child.kill('SIGTERM');
        return spawn(process.execPath, [...(command.next.execArgv ?? []), command.next.scriptPath], {
            env: command.next.env,
            stdio: command.next.stdio,
            shell: false,
        });
    },
    extractBundle(command) {
        extractArchive(command);
    },
};
