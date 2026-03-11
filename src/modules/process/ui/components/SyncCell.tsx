import { RefreshCw } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { Match, Switch } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SyncCellState = 'idle' | 'syncing' | 'success_recent' | 'failed' | 'disabled'

type SyncCellProps = {
  readonly state: SyncCellState
  readonly onSync?: () => void
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

/** Refresh icon – two curved arrows (idle). */
function RefreshIcon(): JSX.Element {
  return (
    <RefreshCw
      class="h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)]"
      strokeWidth={1.75}
      aria-hidden="true"
    />
  )
}

/** Spinner icon (syncing). */
function SpinnerIcon(): JSX.Element {
  return (
    <RefreshCw
      class="h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)] animate-spin"
      strokeWidth={1.75}
      aria-hidden="true"
    />
  )
}

/** Check icon (success_recent). */
function CheckIcon(): JSX.Element {
  return (
    <svg
      class="h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)]"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
  )
}

/** Warning icon (failed). */
function WarningIcon(): JSX.Element {
  return (
    <svg
      class="h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)]"
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
  )
}

/** Muted refresh icon (disabled). */
function MutedRefreshIcon(): JSX.Element {
  return (
    <RefreshCw
      class="h-[var(--dashboard-sync-icon-size)] w-[var(--dashboard-sync-icon-size)] opacity-35"
      strokeWidth={1.75}
      aria-hidden="true"
    />
  )
}

function SyncCellIcon(props: { readonly state: SyncCellState }): JSX.Element {
  return (
    <Switch>
      <Match when={props.state === 'syncing'}>
        <SpinnerIcon />
      </Match>
      <Match when={props.state === 'success_recent'}>
        <CheckIcon />
      </Match>
      <Match when={props.state === 'failed'}>
        <WarningIcon />
      </Match>
      <Match when={props.state === 'disabled'}>
        <MutedRefreshIcon />
      </Match>
      <Match when={props.state === 'idle'}>
        <RefreshIcon />
      </Match>
    </Switch>
  )
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function toButtonClasses(state: SyncCellState): string {
  const base =
    'inline-flex h-[var(--dashboard-sync-button-size)] w-[var(--dashboard-sync-button-size)] items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

  if (state === 'syncing') return `${base} border-blue-200 bg-blue-50 text-blue-700 cursor-default`
  if (state === 'success_recent')
    return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default`
  if (state === 'failed') return `${base} border-red-200 bg-red-50 text-red-700 cursor-default`
  if (state === 'disabled') return `${base} cursor-not-allowed`
  // idle
  return `${base} cursor-pointer`
}

function toAriaLabel(
  state: SyncCellState,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  if (state === 'syncing') return t(keys.dashboard.table.sync.syncing)
  if (state === 'success_recent') return t(keys.dashboard.table.sync.successRecent)
  if (state === 'failed') return t(keys.dashboard.table.sync.failed)
  if (state === 'disabled') return t(keys.dashboard.table.sync.disabled)
  return t(keys.dashboard.table.sync.idle)
}

function isInteractive(state: SyncCellState): boolean {
  return state === 'idle'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncCell(props: SyncCellProps): JSX.Element {
  const { t, keys } = useTranslation()

  const handleClick = (event: MouseEvent): void => {
    event.stopPropagation()
    if (isInteractive(props.state) && props.onSync) {
      props.onSync()
    }
  }

  return (
    <div class="flex min-w-0 items-center justify-center px-[var(--dashboard-table-cell-px)] py-[var(--dashboard-table-cell-py)]">
      <button
        type="button"
        onClick={handleClick}
        disabled={!isInteractive(props.state)}
        aria-busy={props.state === 'syncing'}
        aria-label={toAriaLabel(props.state, t, keys)}
        title={toAriaLabel(props.state, t, keys)}
        class={toButtonClasses(props.state)}
      >
        <SyncCellIcon state={props.state} />
      </button>
    </div>
  )
}
