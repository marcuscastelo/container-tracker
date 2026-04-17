import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { build as esbuild } from 'esbuild'
import { rewriteEmittedImports } from './rewrite-emitted-imports.mjs'

const repoRoot = path.resolve(import.meta.dirname, '../..')
const distRoot = path.join(repoRoot, 'dist', 'apps', 'agent', 'control-ui')
const preloadSourcePath = path.join(repoRoot, 'apps', 'agent', 'src', 'electron', 'preload.cjs')
const preloadTargetPath = path.join(distRoot, 'apps', 'agent', 'src', 'electron', 'preload.cjs')
const electronMainEntryPath = path.join(
  distRoot,
  'apps',
  'agent',
  'src',
  'electron',
  'main',
  'electron-main.js',
)
const electronMainBundlePath = path.join(
  distRoot,
  'apps',
  'agent',
  'src',
  'electron',
  'main',
  'electron-main.cjs',
)
const electronManifestPath = path.join(distRoot, 'package.json')

function runPnpm(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', args, {
      cwd: repoRoot,
      stdio: 'inherit',
      ...(process.platform === 'win32' ? { shell: true } : {}),
    })

    child.once('error', reject)
    child.once('exit', (code) => {
      resolve(code ?? 1)
    })
  })
}

const exitCode = await runPnpm(['exec', 'tsc', '-p', 'apps/agent/tsconfig.control-ui.build.json'])
if (exitCode !== 0) {
  process.exit(exitCode)
}

await fs.mkdir(path.dirname(preloadTargetPath), { recursive: true })
await fs.copyFile(preloadSourcePath, preloadTargetPath)
await fs.writeFile(
  electronManifestPath,
  `${JSON.stringify(
    {
      name: 'container-tracker-agent-control-ui',
      private: true,
      type: 'module',
      main: './apps/agent/src/electron/main/electron-main.cjs',
    },
    null,
    2,
  )}\n`,
  'utf8',
)

rewriteEmittedImports({
  distRoot,
})

await esbuild({
  entryPoints: [electronMainEntryPath],
  outfile: electronMainBundlePath,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node20'],
  external: ['electron'],
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'silent',
})
