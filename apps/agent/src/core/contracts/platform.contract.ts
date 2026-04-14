import type { ChildProcess } from 'node:child_process'
import { z } from 'zod/v4'

export const PlatformPathsSchema = z.object({
  dataDir: z.string().min(1),
})

export type PlatformPaths = z.infer<typeof PlatformPathsSchema>

export type PlatformProcessHandle = {
  readonly pid: number | undefined
  readonly child: ChildProcess
}

export type PlatformAdapter = {
  readonly key: 'linux-x64' | 'windows-x64'
  readonly resolvePaths: (command: { readonly env: NodeJS.ProcessEnv }) => PlatformPaths
  readonly startRuntime: (command: {
    readonly scriptPath: string
    readonly execArgv: readonly string[]
    readonly env: NodeJS.ProcessEnv
    readonly stdio: 'inherit' | 'pipe'
  }) => PlatformProcessHandle
  readonly stopRuntime: (command: { readonly handle: PlatformProcessHandle }) => void
  readonly restartRuntime: (command: {
    readonly handle: PlatformProcessHandle
    readonly next: {
      readonly scriptPath: string
      readonly execArgv: readonly string[]
      readonly env: NodeJS.ProcessEnv
      readonly stdio: 'inherit' | 'pipe'
    }
  }) => PlatformProcessHandle
}
