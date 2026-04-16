import fs from 'node:fs'
import { readJsonFileWithSchema, writeFileAtomic } from '@agent/state/file-io'
import type { z } from 'zod/v4'

export function readStateJsonFile<T extends z.ZodType>(command: {
  readonly filePath: string
  readonly schema: T
}): z.infer<T> | null {
  return readJsonFileWithSchema(command.filePath, command.schema)
}

export function writeStateJsonFile<T extends z.ZodType>(command: {
  readonly filePath: string
  readonly schema: T
  readonly value: unknown
  readonly mode?: number
}): z.infer<T> {
  const normalized = command.schema.parse(command.value)
  writeFileAtomic(command.filePath, `${JSON.stringify(normalized, null, 2)}\n`)

  if (typeof command.mode === 'number') {
    fs.chmodSync(command.filePath, command.mode)
  }

  return normalized
}

export function removeStateFile(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // State cleanup should remain best-effort for control flows.
  }
}
