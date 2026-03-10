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
  const iconClass = () => {
    const baseClass = props.spinning ? 'h-4 w-4 animate-spin' : 'h-4 w-4'
    if (props.error) return `${baseClass} opacity-60`
    return baseClass
  }

  return (
    <svg
      class={iconClass()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <title>{props.title}</title>
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 4v6h6M20 20v-6h-6"
      />
    </svg>
  )
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
      class="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-sm-ui font-semibold text-[var(--accent-primary-text)] shadow-sm transition-colors hover:bg-[var(--accent-primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-1"
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
