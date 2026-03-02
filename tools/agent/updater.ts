import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_DATA_DIR_NAME = 'ContainerTracker'
const MAX_LOG_FILE_SIZE_BYTES = 10 * 1024 * 1024

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function resolveDotenvPath(): string {
  const fromEnv = process.env.DOTENV_PATH?.trim()
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv
  }

  return path.win32.join(resolveDataRoot(), 'config.env')
}

function resolveDataRoot(): string {
  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (localAppData && localAppData.length > 0) {
    return path.win32.join(localAppData, DEFAULT_DATA_DIR_NAME)
  }

  return path.win32.join(os.homedir(), 'AppData', 'Local', DEFAULT_DATA_DIR_NAME)
}

function resolveLogPath(): string {
  return path.win32.join(resolveDataRoot(), 'logs', 'updater.log')
}

function unquoteValue(value: string): string {
  if (value.length < 2) return value
  const first = value.at(0)
  const last = value.at(-1)
  if (!first || !last) return value

  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return value.slice(1, -1)
  }

  return value
}

function parseEnvLine(line: string): { readonly key: string; readonly value: string } | null {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.startsWith('#')) return null

  const separatorIndex = trimmed.indexOf('=')
  if (separatorIndex <= 0) return null

  const key = trimmed.slice(0, separatorIndex).trim()
  const rawValue = trimmed.slice(separatorIndex + 1).trim()
  if (key.length === 0) return null

  return {
    key,
    value: unquoteValue(rawValue),
  }
}

function loadEnvFile(dotenvPath: string): void {
  if (!fs.existsSync(dotenvPath)) {
    throw new Error(`DOTENV_PATH file not found: ${dotenvPath}`)
  }

  const raw = fs.readFileSync(dotenvPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue

    if (typeof process.env[parsed.key] === 'undefined') {
      process.env[parsed.key] = parsed.value
    }
  }
}

function rotateLogIfNeeded(logPath: string): void {
  if (!fs.existsSync(logPath)) {
    return
  }

  const stat = fs.statSync(logPath)
  if (stat.size <= MAX_LOG_FILE_SIZE_BYTES) {
    return
  }

  const rotationPath = `${logPath}.1`
  if (fs.existsSync(rotationPath)) {
    fs.rmSync(rotationPath)
  }

  fs.renameSync(logPath, rotationPath)
}

function appendLogLine(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(line)

  const logPath = resolveLogPath()
  const logDir = path.dirname(logPath)
  fs.mkdirSync(logDir, { recursive: true })
  rotateLogIfNeeded(logPath)
  fs.appendFileSync(logPath, `${line}\n`, 'utf8')
}

function findPackageJsonPath(startDir: string): string | null {
  let current = startDir

  for (;;) {
    const candidate = path.join(current, 'package.json')
    if (fs.existsSync(candidate)) {
      return candidate
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }

    current = parent
  }
}

function readAgentVersion(startDir: string): string {
  const packageJsonPath = findPackageJsonPath(startDir)
  if (!packageJsonPath) {
    return 'unknown'
  }

  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string'
    ) {
      return parsed.version
    }

    return 'unknown'
  } catch {
    return 'unknown'
  }
}

function main(): void {
  const scriptPath = fileURLToPath(import.meta.url)
  const scriptDir = path.dirname(scriptPath)

  try {
    const dotenvPath = resolveDotenvPath()
    loadEnvFile(dotenvPath)

    const version = readAgentVersion(scriptDir)
    appendLogLine(`[updater] version=${version}`)
    appendLogLine(`[updater] timestamp=${new Date().toISOString()}`)
    appendLogLine('[updater] NO UPDATES (stub mode)')
    process.exit(0)
  } catch (error) {
    appendLogLine(`[updater] failed: ${toErrorMessage(error)}`)
    process.exit(1)
  }
}

main()
