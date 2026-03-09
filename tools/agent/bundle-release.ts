import { spawn } from 'node:child_process'
import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const BUNDLE_OUTPUT_RELATIVE_PATH = 'dist/agent-installer-bundle.zip'
const FIXED_ZIP_DATE = new Date('2000-01-01T00:00:00.000Z')

const REQUIRED_RELEASE_FILES = [
  'release/node/node.exe',
  'release/app/dist/agent.js',
  'release/app/dist/updater.js',
  'release/app/dist/tools/agent/supervisor.js',
  'release/config/bootstrap.env',
] as const

const REQUIRED_INSTALLER_FILES = [
  'tools/agent/installer/installer.iss',
  'tools/agent/installer/bootstrap.env.template',
] as const

type ArchiverLike = {
  readonly on: (event: string, callback: (error: unknown) => void) => void
  readonly pipe: (output: NodeJS.WritableStream) => void
  readonly file: (
    absolutePath: string,
    data: { readonly name: string; readonly date: Date },
  ) => void
  readonly finalize: () => Promise<void> | void
}

type ArchiverFactory = (
  format: 'zip',
  options: { readonly zlib: { readonly level: number } },
) => ArchiverLike

function isArchiverFactory(value: unknown): value is ArchiverFactory {
  return typeof value === 'function'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function toPosixPath(relativePath: string): string {
  return relativePath.split(path.sep).join('/')
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function resolveRepoRoot(startDir: string): string {
  let cursor = startDir

  for (;;) {
    const marker = path.join(cursor, 'tools', 'agent', 'agent.ts')
    if (fsSync.existsSync(marker)) {
      return cursor
    }

    const parent = path.dirname(cursor)
    if (parent === cursor) {
      throw new Error('Could not resolve repository root from script location')
    }
    cursor = parent
  }
}

async function ensureRequiredFiles(
  repoRoot: string,
  relativePaths: readonly string[],
  label: string,
): Promise<void> {
  const missing = relativePaths.filter((relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath)
    return !fsSync.existsSync(absolutePath)
  })

  if (missing.length > 0) {
    throw new Error(`${label} missing required files: ${missing.join(', ')}`)
  }
}

async function collectFilesRecursively(
  baseDirAbsolute: string,
  repoRoot: string,
): Promise<readonly string[]> {
  const collected: string[] = []

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      collected.push(path.relative(repoRoot, entryPath))
    }
  }

  await walk(baseDirAbsolute)
  collected.sort((left, right) => left.localeCompare(right))
  return collected
}

function tryLoadArchiverFactory(): ArchiverFactory | null {
  try {
    const require = createRequire(import.meta.url)
    const loaded: unknown = require('archiver')

    if (isArchiverFactory(loaded)) {
      return loaded
    }

    if (isRecord(loaded) && isArchiverFactory(loaded.default)) {
      return loaded.default
    }

    return null
  } catch {
    return null
  }
}

async function createZipWithArchiver(command: {
  readonly repoRoot: string
  readonly zipOutputPath: string
  readonly relativePaths: readonly string[]
}): Promise<void> {
  const archiverFactory = tryLoadArchiverFactory()
  if (!archiverFactory) {
    throw new Error('archiver package is not available')
  }

  await fs.rm(command.zipOutputPath, { force: true })
  await fs.mkdir(path.dirname(command.zipOutputPath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const output = fsSync.createWriteStream(command.zipOutputPath)
    const archive = archiverFactory('zip', {
      zlib: { level: 6 },
    })

    output.on('close', () => {
      resolve()
    })
    output.on('error', (error) => {
      reject(error)
    })
    archive.on('warning', (error) => {
      reject(error)
    })
    archive.on('error', (error) => {
      reject(error)
    })

    archive.pipe(output)
    for (const relativePath of command.relativePaths) {
      archive.file(path.join(command.repoRoot, relativePath), {
        name: toPosixPath(relativePath),
        date: FIXED_ZIP_DATE,
      })
    }

    try {
      const maybePromise = archive.finalize()
      if (maybePromise && typeof maybePromise === 'object' && 'catch' in maybePromise) {
        void maybePromise.catch((error) => reject(error))
      }
    } catch (error) {
      reject(error)
    }
  })
}

async function createZipWithSystemZip(command: {
  readonly repoRoot: string
  readonly zipOutputPath: string
  readonly relativePaths: readonly string[]
}): Promise<void> {
  await fs.rm(command.zipOutputPath, { force: true })
  await fs.mkdir(path.dirname(command.zipOutputPath), { recursive: true })

  await new Promise<void>((resolve, reject) => {
    const child = spawn('zip', ['-X', '-q', command.zipOutputPath, '-@'], {
      cwd: command.repoRoot,
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: false,
    })

    child.on('error', (error) => {
      reject(new Error(`failed to run "zip": ${toErrorMessage(error)}`))
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`"zip" exited with code ${code ?? 'unknown'}`))
    })

    if (!child.stdin) {
      reject(new Error('"zip" stdin is not available'))
      return
    }

    child.stdin.on('error', (error) => {
      reject(new Error(`failed to write zip file list: ${toErrorMessage(error)}`))
    })

    for (const relativePath of command.relativePaths) {
      child.stdin.write(`${toPosixPath(relativePath)}\n`)
    }
    child.stdin.end()
  })
}

async function bundleRelease(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = resolveRepoRoot(scriptDir)
  const releaseDir = path.join(repoRoot, 'release')
  const installerDir = path.join(repoRoot, 'tools', 'agent', 'installer')
  const zipOutputPath = path.join(repoRoot, BUNDLE_OUTPUT_RELATIVE_PATH)

  if (!(await pathExists(releaseDir))) {
    throw new Error('release/ directory not found. Run "pnpm run agent:release" first.')
  }

  await ensureRequiredFiles(repoRoot, REQUIRED_RELEASE_FILES, 'release')
  await ensureRequiredFiles(repoRoot, REQUIRED_INSTALLER_FILES, 'installer')

  const releaseFiles = await collectFilesRecursively(releaseDir, repoRoot)
  const installerFiles = await collectFilesRecursively(installerDir, repoRoot)
  const bundleFiles = [...releaseFiles, ...installerFiles].sort((left, right) =>
    left.localeCompare(right),
  )

  if (bundleFiles.length === 0) {
    throw new Error('No files were selected for bundle archive')
  }

  const archiverFactory = tryLoadArchiverFactory()
  if (archiverFactory) {
    await createZipWithArchiver({
      repoRoot,
      zipOutputPath,
      relativePaths: bundleFiles,
    })
    console.log(`[agent:bundle] bundled ${bundleFiles.length} files with archiver`)
  } else {
    console.warn('[agent:bundle] archiver not installed; falling back to system zip command')
    await createZipWithSystemZip({
      repoRoot,
      zipOutputPath,
      relativePaths: bundleFiles,
    })
    console.log(`[agent:bundle] bundled ${bundleFiles.length} files with system zip`)
  }

  console.log(`[agent:bundle] output: ${path.relative(repoRoot, zipOutputPath)}`)
}

void bundleRelease().catch((error) => {
  console.error(`[agent:bundle] failed: ${toErrorMessage(error)}`)
  process.exit(1)
})
