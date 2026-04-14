import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod/v4'

const supervisorControlSchema = z.object({
  drain_requested: z.boolean(),
  reason: z.enum(['update', 'restart', 'manual']).nullable(),
  requested_at: z.string().datetime({ offset: true }).nullable(),
})

export type SupervisorControl = z.infer<typeof supervisorControlSchema>

function writeFileAtomic(filePath: string, content: string): void {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.renameSync(tempPath, filePath)
}

export function writeSupervisorControl(filePath: string, value: SupervisorControl): void {
  const normalized = supervisorControlSchema.parse(value)
  writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`)
}

export function readSupervisorControl(filePath: string): SupervisorControl | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const normalized = supervisorControlSchema.safeParse(parsed)
    if (!normalized.success) {
      return null
    }

    return normalized.data
  } catch {
    return null
  }
}

export function clearSupervisorControl(filePath: string): void {
  writeSupervisorControl(filePath, {
    drain_requested: false,
    reason: null,
    requested_at: null,
  })
}
