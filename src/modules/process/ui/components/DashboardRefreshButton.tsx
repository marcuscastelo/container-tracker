import { RefreshCw } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, onCleanup } from 'solid-js'
import {
  isDashboardRefreshBlocked,
  toDashboardRefreshCooldownUntilMs,
} from '~/modules/process/ui/utils/dashboard-refresh-button'
import { useTranslation } from '~/shared/localization/i18n'

type RefreshVisualState = 'idle' | 'loading' | 'error'

type RefreshButtonProps = {
  readonly onRefresh: () => Promise<void>
}

function RefreshIcon(props: {
  readonly spinning: boolean
  readonly title: string
  readonly error: boolean
}): JSX.Element {
  const base = () =>
    props.spinning
      ? 'h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)] animate-spin'
      : 'h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)]'
  const cls = () => (props.error ? `${base()} text-tone-danger-fg` : base())
  return <RefreshCw class={cls()} strokeWidth={1.75} aria-hidden="true" />
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
      class="inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] items-center justify-center gap-2 rounded-[var(--dashboard-control-radius)] border border-border bg-surface px-3 text-sm-ui font-medium text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-text-muted/50 disabled:opacity-100"
    >
      <RefreshIcon
        spinning={visualState() === 'loading'}
        title={buttonTitle()}
        error={visualState() === 'error'}
      />
      <span class="hidden min-[1280px]:inline">{buttonLabel()}</span>
    </button>
  )
}
