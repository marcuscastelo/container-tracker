import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

function normalizeStderr(stderr: Buffer | string | null): string {
  if (!stderr) {
    return ''
  }

  if (typeof stderr === 'string') {
    return stderr.trim()
  }

  return stderr.toString('utf8').trim()
}

export function ensureDirectory(pathToEnsure: string): void {
  fs.mkdirSync(pathToEnsure, { recursive: true })
}

export function runCommand(program: string, args: readonly string[]): void {
  const result = spawnSync(program, [...args], {
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: false,
  })

  if (result.status === 0) {
    return
  }

  const stderr = normalizeStderr(result.stderr)
  const stderrSuffix = stderr.length > 0 ? `: ${stderr}` : ''
  throw new Error(
    `command "${program} ${args.join(' ')}" failed with code ${result.status ?? 'unknown'}${stderrSuffix}`,
  )
}

export function tryCommand(program: string, args: readonly string[]): boolean {
  const result = spawnSync(program, [...args], {
    stdio: ['ignore', 'ignore', 'ignore'],
    shell: false,
  })

  return result.status === 0
}
