import { RefreshCw } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

type RefreshVisualState = 'idle' | 'loading' | 'error'

type RefreshButtonProps = {
  readonly onRefresh: () => Promise<void>
}

export const DASHBOARD_REFRESH_COOLDOWN_MS = 2_000

export function toDashboardRefreshCooldownUntilMs(
  clickStartedAtMs: number,
  cooldownMs: number = DASHBOARD_REFRESH_COOLDOWN_MS,
): number {
  return clickStartedAtMs + cooldownMs
}

export function isDashboardRefreshBlocked(command: {
  readonly isLoading: boolean
  readonly cooldownUntilMs: number | null
  readonly nowMs: number
}): boolean {
  if (command.isLoading) return true
  if (command.cooldownUntilMs === null) return false
  return command.nowMs < command.cooldownUntilMs
}

function RefreshIcon(props: {
  readonly spinning: boolean
  readonly title: string
  readonly error: boolean
}): JSX.Element {
  const base = props.spinning ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
  const cls = props.error ? `${base} text-red-200` : base
  return <RefreshCw class={cls} title={props.title} aria-hidden="true" />
}

export function DashboardRefreshButton(props: RefreshButtonProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [visualState, setVisualState] = createSignal<RefreshVisualState>('idle')
  const [isLoading, setIsLoading] = createSignal(false)
  const [cooldownUntilMs, setCooldownUntilMs] = createSignal<number | null>(null)

  let cooldownTimerId: ReturnType<typeof globalThis.setTimeout> | null = null

  const clearCooldownTimer = (): void => {
    if (cooldownTimerId === null) return
    globalThis.clearTimeout(cooldownTimerId)
    cooldownTimerId = null
  }

  const scheduleCooldownRelease = (untilMs: number): void => {
    clearCooldownTimer()
    const delayMs = Math.max(0, untilMs - Date.now())
    cooldownTimerId = globalThis.setTimeout(() => {
      setCooldownUntilMs((currentValue) => {
        if (currentValue === null) return currentValue
        if (Date.now() >= currentValue) return null
        return currentValue
      })
      cooldownTimerId = null
    }, delayMs)
  }

  onCleanup(() => {
    clearCooldownTimer()
  })

  const isBlocked = createMemo(() =>
    isDashboardRefreshBlocked({
      isLoading: isLoading(),
      cooldownUntilMs: cooldownUntilMs(),
      nowMs: Date.now(),
    }),
  )

  const buttonLabel = createMemo(() => {
    if (visualState() === 'loading') {
      return t(keys.dashboard.actions.syncing)
    }

    return t(keys.dashboard.actions.sync)
  })

  const buttonTitle = createMemo(() => {
    if (visualState() === 'error') {
      return t(keys.dashboard.actions.syncFailed)
    }
    if (visualState() === 'loading') {
      return t(keys.dashboard.actions.syncing)
    }
    return t(keys.dashboard.actions.sync)
  })

  const handleClick = async () => {
    if (isBlocked()) {
      return
    }

    const clickStartedAtMs = Date.now()
    const nextCooldownUntilMs = toDashboardRefreshCooldownUntilMs(clickStartedAtMs)
    setCooldownUntilMs(nextCooldownUntilMs)
    scheduleCooldownRelease(nextCooldownUntilMs)

    setIsLoading(true)
    setVisualState('loading')

    try {
      await props.onRefresh()
      setVisualState('idle')
    } catch (error) {
      console.error('Dashboard sync failed:', error)
      setVisualState('error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isBlocked()}
      aria-busy={isLoading()}
      title={buttonTitle()}
      class="inline-flex items-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm-ui font-medium text-white transition-colors hover:bg-blue-700 hover:border-blue-700 disabled:bg-blue-400 disabled:border-blue-400 disabled:cursor-not-allowed"
    >
      <RefreshIcon
        spinning={visualState() === 'loading'}
        title={buttonTitle()}
        error={visualState() === 'error'}
      />
      <span>{buttonLabel()}</span>
    </button>
  )
}
