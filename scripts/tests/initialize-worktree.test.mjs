import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const repoRoot = process.cwd()
const scriptPath = path.join(repoRoot, 'scripts', 'initialize-worktree.mjs')

function makeTempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'initialize-worktree-'))
}

async function writeFile(targetPath, content) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, content)
}

function readFile(targetPath) {
  return fs.readFile(targetPath, 'utf8')
}

async function runInitialize(worktreePath, options = {}) {
  try {
    const result = await execFileAsync(process.execPath, [scriptPath], {
      cwd: worktreePath,
      env: {
        ...process.env,
        ...options.env,
      },
    })

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    }
  } catch (error) {
    return {
      exitCode: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    }
  }
}

async function createRootRepo({ rootDir, includeSourceEnv = true, config = defaultConfig() }) {
  await fs.mkdir(path.join(rootDir, '.git'), { recursive: true })
  await writeFile(path.join(rootDir, '.git', 'HEAD'), 'ref: refs/heads/main\n')

  if (includeSourceEnv) {
    await writeFile(path.join(rootDir, '.env'), 'ROOT_ENV=1\n')
  }

  await writeFile(path.join(rootDir, '.worktree-initialization.toml'), config)
}

async function createLinkedWorktree(rootDir, worktreeName = 'feature-worktree') {
  const worktreePath = path.join(rootDir, 'wt', worktreeName)
  const gitDir = path.join(rootDir, '.git', 'worktrees', worktreeName)

  await fs.mkdir(gitDir, { recursive: true })
  await fs.mkdir(worktreePath, { recursive: true })
  await writeFile(path.join(gitDir, 'commondir'), '../..\n')
  await writeFile(
    path.join(worktreePath, '.git'),
    `gitdir: ${path.relative(worktreePath, gitDir)}\n`,
  )
  await fs.copyFile(
    path.join(rootDir, '.worktree-initialization.toml'),
    path.join(worktreePath, '.worktree-initialization.toml'),
  )

  return { worktreePath, gitDir }
}

function defaultConfig() {
  return [
    '[[copy]]',
    'source = ".env"',
    'target = ".env"',
    'required = true',
    'overwrite = false',
    '',
    '[[run]]',
    `command = "${process.execPath} -e \\"const fs = require('node:fs'); fs.writeFileSync('run.log', process.cwd())\\""`,
    'required = true',
    '',
  ].join('\n')
}

const tempDirs = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (tempDir) => {
      await fs.rm(tempDir, { recursive: true, force: true })
    }),
  )
})

describe('initialize-worktree', () => {
  it('fails when executed in the main repo', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })

    const result = await runInitialize(tempDir)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Current directory is not a Git worktree.')
    expect(result.stderr).toContain(`cwd: ${tempDir}`)
  })

  it('fails when config is missing in the worktree root', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })
    const { worktreePath } = await createLinkedWorktree(tempDir)
    await fs.rm(path.join(worktreePath, '.worktree-initialization.toml'))

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Config file not found:')
  })

  it('detects .git files and resolves the main repo path', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })
    const { worktreePath, gitDir } = await createLinkedWorktree(tempDir, 'resolve-gitdir')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`worktree detected: ${gitDir}`)
    expect(result.stdout).toContain(`main repo: ${tempDir}`)
  })

  it('copies .env when source exists and target is missing', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'copy-env')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    await expect(readFile(path.join(worktreePath, '.env'))).resolves.toBe('ROOT_ENV=1\n')
  })

  it('does not overwrite an existing target when overwrite is false', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'no-overwrite')
    await writeFile(path.join(worktreePath, '.env'), 'WORKTREE_ENV=1\n')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    await expect(readFile(path.join(worktreePath, '.env'))).resolves.toBe('WORKTREE_ENV=1\n')
    expect(result.stdout).toContain('skip existing target: .env')
  })

  it('overwrites an existing target when overwrite is true in config', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    const config = [
      '[[copy]]',
      'source = ".env"',
      'target = ".env"',
      'required = true',
      'overwrite = true',
      '',
    ].join('\n')

    await createRootRepo({ rootDir: tempDir, config })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'overwrite-config')
    await writeFile(path.join(worktreePath, '.env'), 'WORKTREE_ENV=1\n')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    await expect(readFile(path.join(worktreePath, '.env'))).resolves.toBe('ROOT_ENV=1\n')
  })

  it('overwrites an existing target when force overwrite env is enabled', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'overwrite-env')
    await writeFile(path.join(worktreePath, '.env'), 'WORKTREE_ENV=1\n')

    const result = await runInitialize(worktreePath, {
      env: { INITIALIZE_WORKTREE_FORCE_OVERWRITE: '1' },
    })

    expect(result.exitCode).toBe(0)
    await expect(readFile(path.join(worktreePath, '.env'))).resolves.toBe('ROOT_ENV=1\n')
  })

  it('fails when a required source file is missing', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir, includeSourceEnv: false })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'required-source')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Required source file does not exist:')
  })

  it('skips an optional missing source', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    const config = [
      '[[copy]]',
      'source = ".env.optional"',
      'target = ".env.optional"',
      'required = false',
      '',
    ].join('\n')

    await createRootRepo({ rootDir: tempDir, includeSourceEnv: false, config })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'optional-source')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toContain('skipping missing optional source:')
  })

  it('executes run commands with the worktree as cwd', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({ rootDir: tempDir })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'run-command')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    await expect(readFile(path.join(worktreePath, 'run.log'))).resolves.toBe(worktreePath)
  })

  it('fails when a required command exits with a non-zero status', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    const config = [
      '[[run]]',
      `command = "${process.execPath} -e \\"process.exit(7)\\""`,
      'required = true',
      '',
    ].join('\n')

    await createRootRepo({ rootDir: tempDir, config })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'required-command')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Command exited with code 7')
  })

  it('continues when an optional command fails', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    const config = [
      '[[run]]',
      `command = "${process.execPath} -e \\"process.exit(9)\\""`,
      'required = false',
      '',
      '[[run]]',
      `command = "${process.execPath} -e \\"const fs = require('node:fs'); fs.writeFileSync('optional-ok.log', 'done')\\""`,
      'required = true',
      '',
    ].join('\n')

    await createRootRepo({ rootDir: tempDir, config })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'optional-command')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toContain('optional command failed:')
    await expect(readFile(path.join(worktreePath, 'optional-ok.log'))).resolves.toBe('done')
  })

  it('rejects sources that escape the main repo root', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    const config = ['[[copy]]', 'source = "../outside.txt"', 'target = ".env"', ''].join('\n')

    await createRootRepo({ rootDir: tempDir, config })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'escape-source')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Resolved source path escapes root:')
  })

  it('rejects targets that escape the worktree root', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    const config = ['[[copy]]', 'source = ".env"', 'target = "../outside.env"', ''].join('\n')

    await createRootRepo({ rootDir: tempDir, config })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'escape-target')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Resolved target path escapes root:')
  })

  it('rejects unsupported TOML syntax', async () => {
    const tempDir = await makeTempDir()
    tempDirs.push(tempDir)
    await createRootRepo({
      rootDir: tempDir,
      config: '[copy]\nsource = ".env"\n',
    })
    const { worktreePath } = await createLinkedWorktree(tempDir, 'invalid-toml')

    const result = await runInitialize(worktreePath)

    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Unsupported TOML line:')
  })
})
