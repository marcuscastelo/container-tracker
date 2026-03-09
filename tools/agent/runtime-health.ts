import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { z } from 'zod/v4'

export type AgentBootStatus = 'starting' | 'healthy' | 'degraded' | 'unknown'

export type AgentUpdateState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'draining'
  | 'applying'
  | 'rollback'
  | 'blocked'
  | 'error'
  | 'unknown'

const runtimeHealthSchema = z.object({
  agent_version: z.string().min(1),
  boot_status: z.enum(['starting', 'healthy', 'degraded', 'unknown']),
  update_state: z.enum([
    'idle',
    'checking',
    'downloading',
    'ready',
    'draining',
    'applying',
    'rollback',
    'blocked',
    'error',
    'unknown',
  ]),
  last_heartbeat_at: z.string().datetime({ offset: true }).nullable(),
  last_heartbeat_ok_at: z.string().datetime({ offset: true }).nullable(),
  active_jobs: z.number().int().min(0),
  processing_state: z.enum(['idle', 'leasing', 'processing', 'backing_off', 'unknown']),
  updated_at: z.string().datetime({ offset: true }),
  pid: z.number().int().positive(),
})

export type RuntimeHealthRecord = z.infer<typeof runtimeHealthSchema>

function writeFileAtomic(filePath: string, content: string): void {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tempPath, content, 'utf8')
  fs.renameSync(tempPath, filePath)
}

export function writeRuntimeHealth(filePath: string, record: RuntimeHealthRecord): void {
  const normalized = runtimeHealthSchema.parse(record)
  writeFileAtomic(filePath, `${JSON.stringify(normalized, null, 2)}\n`)
}

export function readRuntimeHealth(filePath: string): RuntimeHealthRecord | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const normalized = runtimeHealthSchema.safeParse(parsed)
    if (!normalized.success) {
      return null
    }

    return normalized.data
  } catch {
    return null
  }
}
