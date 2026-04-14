import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { z } from 'zod/v4';
const supervisorControlSchema = z.object({
    drain_requested: z.boolean(),
    reason: z.enum(['update', 'restart', 'manual']).nullable(),
    requested_at: z.string().datetime({ offset: true }).nullable(),
});
function writeFileAtomic(filePath, content) {
    const parentDir = path.dirname(filePath);
    fs.mkdirSync(parentDir, { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
}
export function writeSupervisorControl(filePath, value) {
    const normalized = supervisorControlSchema.parse(value);
    writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`);
}
export function readSupervisorControl(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        const normalized = supervisorControlSchema.safeParse(parsed);
        if (!normalized.success) {
            return null;
        }
        return normalized.data;
    }
    catch {
        return null;
    }
}
export function clearSupervisorControl(filePath) {
    writeSupervisorControl(filePath, {
        drain_requested: false,
        reason: null,
        requested_at: null,
    });
}
