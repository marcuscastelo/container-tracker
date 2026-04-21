import { createMemo, createSignal } from 'solid-js'
import {
  applyInternalTrackingReplay,
  fetchInternalTrackingReplayEnabled,
  fetchInternalTrackingReplayRun,
  lookupInternalTrackingReplayTarget,
  previewInternalTrackingReplay,
  rollbackInternalTrackingReplay,
} from '~/modules/process/ui/api/internal-tracking-replay.api'
import {
  toTrackingReplayDiffVm,
  toTrackingReplayRunVm,
  toTrackingReplayTargetVm,
} from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.ui-mapper'
import type {
  TrackingReplayDiffVM,
  TrackingReplayRunVM,
  TrackingReplayTargetVM,
  TrackingReplayViewState,
} from '~/modules/process/ui/screens/internal-tracking-replay/trackingReplay.vm'
import { TypedFetchError } from '~/shared/api/typedFetch'

type ReplayAction = 'lookup' | 'preview' | 'apply' | 'rollback'

function toErrorMessage(error: unknown): string {
  if (error instanceof TypedFetchError && error.status === 404 && error.message === 'Not found') {
    return 'Replay access token is invalid or replay is unavailable.'
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return 'Internal tracking replay failed'
}

function normalizeReason(value: string): string | null {
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

type ReplayAvailabilityCommand = {
  readonly setState: (value: TrackingReplayViewState) => void
  readonly setErrorMessage: (value: string | null) => void
  readonly setIsEnabled: (value: boolean) => void
  readonly setIsDisabled: (value: boolean) => void
}

async function loadReplayAvailability(command: ReplayAvailabilityCommand): Promise<void> {
  command.setState('loading')
  command.setErrorMessage(null)

  try {
    await fetchInternalTrackingReplayEnabled()
    command.setIsEnabled(true)
    command.setIsDisabled(false)
    command.setState('empty')
  } catch (error) {
    if (error instanceof TypedFetchError && error.status === 404) {
      command.setIsEnabled(false)
      command.setIsDisabled(true)
      command.setState('empty')
      return
    }

    command.setIsEnabled(false)
    command.setIsDisabled(false)
    command.setState('error')
    command.setErrorMessage(toErrorMessage(error))
  }
}

export type TrackingReplayController = {
  readonly state: () => TrackingReplayViewState
  readonly isEnabled: () => boolean
  readonly isDisabled: () => boolean
  readonly target: () => TrackingReplayTargetVM | null
  readonly currentRun: () => TrackingReplayRunVM | null
  readonly diff: () => TrackingReplayDiffVM | null
  readonly authTokenInput: () => string
  readonly containerNumberInput: () => string
  readonly reasonInput: () => string
  readonly errorMessage: () => string | null
  readonly busyAction: () => ReplayAction | null
  readonly isBusy: () => boolean
  readonly setAuthTokenInput: (value: string) => void
  readonly setContainerNumberInput: (value: string) => void
  readonly setReasonInput: (value: string) => void
  readonly lookup: () => Promise<void>
  readonly preview: () => Promise<void>
  readonly apply: () => Promise<void>
  readonly rollback: () => Promise<void>
}

export function useTrackingReplayController(): TrackingReplayController {
  const [state, setState] = createSignal<TrackingReplayViewState>('loading')
  const [isEnabled, setIsEnabled] = createSignal(false)
  const [isDisabled, setIsDisabled] = createSignal(false)

  const [authTokenInput, setAuthTokenInput] = createSignal('')
  const [containerNumberInput, setContainerNumberInput] = createSignal('')
  const [reasonInput, setReasonInput] = createSignal('')

  const [target, setTarget] = createSignal<TrackingReplayTargetVM | null>(null)
  const [currentRun, setCurrentRun] = createSignal<TrackingReplayRunVM | null>(null)
  const [diff, setDiff] = createSignal<TrackingReplayDiffVM | null>(null)

  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)
  const [busyAction, setBusyAction] = createSignal<ReplayAction | null>(null)

  const isBusy = createMemo(() => busyAction() !== null)

  function clearExecutionState(): void {
    setCurrentRun(null)
    setDiff(null)
  }

  function requireAuthToken(): string | null {
    const normalizedAuthToken = authTokenInput().trim()
    if (normalizedAuthToken.length === 0) {
      setErrorMessage('Provide replay access token.')
      return null
    }

    return normalizedAuthToken
  }

  async function refreshTargetByContainerNumber(
    containerNumber: string,
    authToken: string,
  ): Promise<void> {
    const lookupResponse = await lookupInternalTrackingReplayTarget({
      authToken,
      containerNumber,
    })

    setTarget(toTrackingReplayTargetVm(lookupResponse))
    setContainerNumberInput(lookupResponse.containerNumber)
    setState('ready')
  }

  async function executeRunAction(command: {
    readonly action: Exclude<ReplayAction, 'lookup'>
    readonly run: (authToken: string) => Promise<void>
  }): Promise<void> {
    if (target() === null) {
      setErrorMessage('Lookup a container before running replay actions.')
      return
    }

    const authToken = requireAuthToken()
    if (authToken === null) {
      return
    }

    setBusyAction(command.action)
    setErrorMessage(null)

    try {
      await command.run(authToken)
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      if (state() === 'loading') {
        setState('error')
      }
    } finally {
      setBusyAction(null)
    }
  }

  async function lookup(): Promise<void> {
    if (isDisabled()) {
      return
    }

    const normalizedContainerNumber = containerNumberInput().trim().toUpperCase()
    if (normalizedContainerNumber.length === 0) {
      setErrorMessage('Provide a container number.')
      return
    }

    const authToken = requireAuthToken()
    if (authToken === null) {
      return
    }

    setBusyAction('lookup')
    setErrorMessage(null)

    try {
      const lookupResponse = await lookupInternalTrackingReplayTarget({
        authToken,
        containerNumber: normalizedContainerNumber,
      })

      setTarget(toTrackingReplayTargetVm(lookupResponse))
      setContainerNumberInput(lookupResponse.containerNumber)
      clearExecutionState()
      setState('ready')
    } catch (error) {
      setErrorMessage(toErrorMessage(error))
      setTarget(null)
      clearExecutionState()
      setState('error')
    } finally {
      setBusyAction(null)
    }
  }

  async function preview(): Promise<void> {
    await executeRunAction({
      action: 'preview',
      run: async (authToken) => {
        const selectedTarget = target()
        if (selectedTarget === null) {
          return
        }

        const run = await previewInternalTrackingReplay({
          authToken,
          containerId: selectedTarget.containerId,
          reason: normalizeReason(reasonInput()),
        })

        setCurrentRun(toTrackingReplayRunVm(run))
        setDiff(toTrackingReplayDiffVm(run))
        await refreshTargetByContainerNumber(selectedTarget.containerNumber, authToken)
      },
    })
  }

  async function apply(): Promise<void> {
    await executeRunAction({
      action: 'apply',
      run: async (authToken) => {
        const selectedTarget = target()
        if (selectedTarget === null) {
          return
        }

        const run = await applyInternalTrackingReplay({
          authToken,
          containerId: selectedTarget.containerId,
          reason: normalizeReason(reasonInput()),
        })

        setCurrentRun(toTrackingReplayRunVm(run))
        setDiff(toTrackingReplayDiffVm(run))
        await refreshTargetByContainerNumber(selectedTarget.containerNumber, authToken)
      },
    })
  }

  async function rollback(): Promise<void> {
    await executeRunAction({
      action: 'rollback',
      run: async (authToken) => {
        const selectedTarget = target()
        if (selectedTarget === null) {
          return
        }

        const rollbackResponse = await rollbackInternalTrackingReplay({
          authToken,
          containerId: selectedTarget.containerId,
          reason: normalizeReason(reasonInput()),
        })

        const run = await fetchInternalTrackingReplayRun({
          authToken,
          runId: rollbackResponse.runId,
        })

        setCurrentRun(toTrackingReplayRunVm(run))
        setDiff(toTrackingReplayDiffVm(run))
        await refreshTargetByContainerNumber(selectedTarget.containerNumber, authToken)
      },
    })
  }

  void loadReplayAvailability({
    setState,
    setErrorMessage,
    setIsEnabled,
    setIsDisabled,
  })

  return {
    state,
    isEnabled,
    isDisabled,
    target,
    currentRun,
    diff,
    authTokenInput,
    containerNumberInput,
    reasonInput,
    errorMessage,
    busyAction,
    isBusy,
    setAuthTokenInput,
    setContainerNumberInput,
    setReasonInput,
    lookup,
    preview,
    apply,
    rollback,
  }
}
