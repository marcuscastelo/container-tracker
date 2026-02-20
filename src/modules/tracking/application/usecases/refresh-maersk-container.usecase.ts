type RefreshContainerRecord = {
  readonly id: string
}

type ContainerLookupPort = {
  findByNumbers(command: {
    readonly containerNumbers: readonly string[]
  }): Promise<{ readonly containers: readonly RefreshContainerRecord[] }>
}

type SaveAndProcessPort = {
  saveAndProcess(
    containerId: string,
    containerNumber: string,
    provider: 'maersk',
    payload: unknown,
    parseError: string | null,
  ): Promise<{
    readonly snapshot: { readonly id: string }
    readonly pipeline: {
      readonly newObservations: readonly unknown[]
      readonly newAlerts: readonly unknown[]
      readonly status: string
    }
  }>
}

export type MaerskCaptureCommand = {
  readonly container: string
  readonly headless: boolean
  readonly hold: boolean
  readonly timeoutMs: number
  readonly userDataDir: string | null
}

export type MaerskCaptureResult =
  | {
      readonly kind: 'ok'
      readonly status: number
      readonly payload: unknown
    }
  | {
      readonly kind: 'error'
      readonly status: number
      readonly body: Record<string, unknown>
    }

type MaerskCapturePort = {
  capture(command: MaerskCaptureCommand): Promise<MaerskCaptureResult>
}

export type RefreshMaerskContainerCommand = {
  readonly container: string
  readonly headless: boolean
  readonly hold: boolean
  readonly timeoutMs: number
  readonly userDataDir: string | null
}

type RefreshMaerskErrorResult = {
  readonly kind: 'error'
  readonly status: number
  readonly body: Record<string, unknown>
}

type RefreshMaerskOkResult = {
  readonly kind: 'ok'
  readonly status: 200
  readonly body: {
    readonly ok: true
    readonly container: string
    readonly status: number
    readonly savedToSupabase: boolean
  }
}

export type RefreshMaerskContainerResult = RefreshMaerskErrorResult | RefreshMaerskOkResult

export type RefreshMaerskContainerDeps = {
  readonly maerskCaptureService: MaerskCapturePort
  readonly containerLookup: ContainerLookupPort
  readonly saveAndProcess: SaveAndProcessPort
}

function isCaptureError(
  result: MaerskCaptureResult,
): result is Extract<MaerskCaptureResult, { kind: 'error' }> {
  return result.kind === 'error'
}

export function createRefreshMaerskContainerUseCase(deps: RefreshMaerskContainerDeps) {
  return async function execute(
    command: RefreshMaerskContainerCommand,
  ): Promise<RefreshMaerskContainerResult> {
    const capture = await deps.maerskCaptureService.capture({
      container: command.container,
      headless: command.headless,
      hold: command.hold,
      timeoutMs: command.timeoutMs,
      userDataDir: command.userDataDir,
    })

    if (isCaptureError(capture)) {
      return {
        kind: 'error',
        status: capture.status,
        body: capture.body,
      }
    }

    const lookup = await deps.containerLookup.findByNumbers({
      containerNumbers: [command.container],
    })

    const container = lookup.containers[0]
    let savedToSupabase = false

    if (container) {
      const result = await deps.saveAndProcess.saveAndProcess(
        container.id,
        command.container,
        'maersk',
        capture.payload,
        null,
      )
      savedToSupabase = true
      console.log(
        `[maersk-refresh] Saved snapshot ${result.snapshot.id} for container ${command.container}, ` +
          `new observations: ${result.pipeline.newObservations.length}, ` +
          `new alerts: ${result.pipeline.newAlerts.length}, ` +
          `status: ${result.pipeline.status}`,
      )
    } else {
      console.warn(
        `[maersk-refresh] Container ${command.container} not found in DB, snapshot not saved`,
      )
    }

    return {
      kind: 'ok',
      status: 200,
      body: {
        ok: true,
        container: command.container,
        status: capture.status,
        savedToSupabase,
      },
    }
  }
}
