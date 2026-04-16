import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { isWindowsPlatform } from '@agent/platform/os-branching'
import type { z } from 'zod/v4'

function replaceFileAtomic(tempPath: string, filePath: string): void {
  if (isWindowsPlatform() && fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true })
  }

  fs.renameSync(tempPath, filePath)
}

export function writeFileAtomic(filePath: string, content: Buffer | string): void {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })

  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`
  let replaced = false
  try {
    if (typeof content === 'string') {
      fs.writeFileSync(tempPath, content, 'utf8')
    } else {
      fs.writeFileSync(tempPath, content)
    }

    replaceFileAtomic(tempPath, filePath)
    replaced = true
  } finally {
    if (!replaced && fs.existsSync(tempPath)) {
      try {
        fs.rmSync(tempPath, { force: true })
      } catch {
        // Best-effort cleanup for failed atomic writes.
      }
    }
  }
}

export function readJsonFileWithSchema<T extends z.ZodType>(
  filePath: string,
  schema: T,
): z.infer<T> | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const normalized = schema.safeParse(parsed)
    if (!normalized.success) {
      return null
    }

    return normalized.data
  } catch {
    return null
  }
}

export function readUnknownJsonFile(filePath: string): unknown | null {
  if (!fs.existsSync(filePath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}
