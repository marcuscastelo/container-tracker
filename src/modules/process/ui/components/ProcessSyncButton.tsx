import type { JSX } from 'solid-js'
import { createMemo, createSignal, Match, Switch } from 'solid-js'
import type { ProcessSyncStatus } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

type SyncStatus = ProcessSyncStatus

type ProcessSyncButtonProps = {
  readonly processId: string
  readonly status: SyncStatus
  readonly lastSyncAt?: string | null
  readonly onSync: (processId: string) => Promise<void>
}

type LocalSyncFeedback = 'success' | 'error' | null

export function resolveProcessSyncVisualState(command: {
  readonly statusFromServer: SyncStatus
  readonly isSubmitting: boolean
  readonly localFeedback: LocalSyncFeedback
}): SyncStatus {
  // Priority:
  // 1. Local submitting -> syncing
  // 2. Server-reported syncing -> syncing
  // 3. Local ephemeral feedback (success / error) -> shown locally
  // 4. Otherwise idle
  if (command.isSubmitting) return 'syncing'
  // If server reports any non-idle state, prefer it over local ephemeral feedback.
  if (command.statusFromServer !== 'idle') return command.statusFromServer
  if (command.localFeedback === 'success') return 'success'
  if (command.localFeedback === 'error') return 'error'
  return 'idle'
}

function toSyncStateLabel(
  status: SyncStatus,
  t: (key: string, options?: Record<string, unknown>) => string,
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (status === 'syncing') return t(keys.dashboard.table.sync.syncing)
  if (status === 'success') return t(keys.dashboard.table.sync.success)
  if (status === 'error') return t(keys.dashboard.table.sync.error)
  return t(keys.dashboard.table.sync.idle)
}

function toButtonClasses(status: SyncStatus): string {
  const base =
    'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60'

  if (status === 'syncing')
    return `${base} border-tone-info-border bg-tone-info-bg text-tone-info-fg`
  if (status === 'success')
    return `${base} border-tone-success-border bg-tone-success-bg text-tone-success-fg`
  if (status === 'error')
    return `${base} border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg`
  return `${base} border-control-border bg-control-bg text-control-foreground hover:border-control-border-hover hover:bg-control-bg-hover hover:text-control-foreground-strong`
}

function SyncIcon(props: { readonly status: SyncStatus }): JSX.Element {
  return (
    <Switch>
      <Match when={props.status === 'syncing'}>
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path class="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v2a7 7 0 017 7h2z" />
        </svg>
      </Match>
      <Match when={props.status === 'success'}>
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </Match>
      <Match when={props.status === 'error'}>
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
          />
        </svg>
      </Match>
      <Match when={true}>
        <svg
          class="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v6h6M20 20v-6h-6"
          />
        </svg>
      </Match>
    </Switch>
  )
}

export function ProcessSyncButton(props: ProcessSyncButtonProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [isSubmitting, setIsSubmitting] = createSignal(false)
  const [localFeedback, setLocalFeedback] = createSignal<LocalSyncFeedback>(null)

  const visualStatus = createMemo(() =>
    resolveProcessSyncVisualState({
      statusFromServer: props.status,
      isSubmitting: isSubmitting(),
      localFeedback: localFeedback(),
    }),
  )

  const title = createMemo(() => {
    const stateLabel = toSyncStateLabel(visualStatus(), t, keys)
    const lastSyncAt = props.lastSyncAt
    if (!lastSyncAt) return stateLabel
    return t(keys.dashboard.table.sync.lastSyncAt, {
      state: stateLabel,
      timestamp: formatDateForLocale(lastSyncAt),
    })
  })

  const isBlocked = createMemo(() => isSubmitting() || visualStatus() === 'syncing')

  const handleClick = async (): Promise<void> => {
    if (isBlocked()) {
      return
    }

    setIsSubmitting(true)
    setLocalFeedback(null)

    try {
      await props.onSync(props.processId)
      setLocalFeedback('success')
    } catch (error) {
      console.error(`Process sync failed for ${props.processId}:`, error)
      setLocalFeedback('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void handleClick()
      }}
      disabled={isBlocked()}
      aria-busy={visualStatus() === 'syncing'}
      aria-label={title()}
      title={title()}
      class={toButtonClasses(visualStatus())}
    >
      <SyncIcon status={visualStatus()} />
    </button>
  )
}
