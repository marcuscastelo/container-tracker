#!/usr/bin/env node
import path from 'node:path';
import { runSupervisorMain } from '@agent/supervisor/supervisor.entry';
export function isSupervisorEntrypoint(entrypoint = process.argv[1]) {
    if (!entrypoint) {
        return false;
    }
    const entrypointName = path.basename(entrypoint).toLowerCase();
    return entrypointName === 'supervisor.js' || entrypointName === 'supervisor.ts';
}
if (isSupervisorEntrypoint()) {
    void runSupervisorMain().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[supervisor] fatal error: ${message}`);
        process.exitCode = 1;
    });
}
