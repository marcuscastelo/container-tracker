import type { JSX } from 'solid-js'
import { createMemo, createSignal } from 'solid-js'
import type { ProcessSyncStatus } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { formatDateForLocale } from '~/shared/utils/formatDate'

export type SyncStatus = ProcessSyncStatus

export type ProcessSyncButtonProps = {
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
  if (command.statusFromServer === 'syncing') return 'syncing'
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
    'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-60'

  if (status === 'syncing') return `${base} border-blue-200 bg-blue-50 text-blue-700`
  if (status === 'success') return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`
  if (status === 'error') return `${base} border-red-200 bg-red-50 text-red-700`
  return `${base} border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50`
}

function SyncIcon(props: { readonly status: SyncStatus }): JSX.Element {
  if (props.status === 'syncing') {
    return (
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
        <path class="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v2a7 7 0 017 7h2z" />
      </svg>
    )
  }

  if (props.status === 'success') {
    return (
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.2"
          d="M5 13l4 4L19 7"
        />
      </svg>
    )
  }

  if (props.status === 'error') {
    return (
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
        />
      </svg>
    )
  }

  return (
    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M4 4v6h6M20 20v-6h-6"
      />
    </svg>
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

  const isBlocked = createMemo(() => isSubmitting() || props.status === 'syncing')

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
      aria-busy={isSubmitting()}
      aria-label={title()}
      title={title()}
      class={toButtonClasses(visualStatus())}
    >
      <SyncIcon status={visualStatus()} />
    </button>
  )
}
