import fs from 'node:fs'
import { readJsonFileWithSchema, writeFileAtomic } from '@agent/state/file-io'
import { z } from 'zod/v4'

const supervisorControlSchema = z.object({
  drain_requested: z.boolean(),
  reason: z.enum(['update', 'restart', 'manual']).nullable(),
  requested_at: z.string().datetime({ offset: true }).nullable(),
})

export type SupervisorControl = z.infer<typeof supervisorControlSchema>

export function writeSupervisorControl(filePath: string, value: SupervisorControl): void {
  const normalized = supervisorControlSchema.parse(value)
  writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`)
}

export function readSupervisorControl(filePath: string): SupervisorControl | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  return readJsonFileWithSchema(filePath, supervisorControlSchema)
}

export function clearSupervisorControl(filePath: string): void {
  writeSupervisorControl(filePath, {
    drain_requested: false,
    reason: null,
    requested_at: null,
  })
}
