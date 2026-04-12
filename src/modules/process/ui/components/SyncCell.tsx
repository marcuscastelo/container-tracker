import { CircleAlert, RefreshCw, TriangleAlert } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { Match, Show, Switch } from 'solid-js'
import type { DashboardProcessSyncIssueVM } from '~/modules/process/ui/viewmodels/dashboard-sync-batch-result.vm'
import { useTranslation } from '~/shared/localization/i18n'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SyncCellState = 'idle' | 'syncing' | 'success_recent' | 'failed' | 'disabled'

type SyncCellProps = {
  readonly state: SyncCellState
  readonly issue?: DashboardProcessSyncIssueVM | null
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

function SyncIssueBadge(props: {
  readonly issue: DashboardProcessSyncIssueVM
}): JSX.Element {
  const badgeClass =
    props.issue.severity === 'danger'
      ? 'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg'
      : 'border-tone-warning-border bg-tone-warning-bg text-tone-warning-fg'

  return (
    <span
      class={`pointer-events-none absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border ${badgeClass}`}
      aria-hidden="true"
    >
      <Show
        when={props.issue.severity === 'danger'}
        fallback={<CircleAlert class="h-2.5 w-2.5" strokeWidth={2} />}
      >
        <TriangleAlert class="h-2.5 w-2.5" strokeWidth={2} />
      </Show>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function toButtonClasses(state: SyncCellState): string {
  const base =
    'inline-flex h-[var(--dashboard-sync-button-size)] w-[var(--dashboard-sync-button-size)] items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'

  if (state === 'syncing')
    return `${base} border-tone-info-border bg-tone-info-bg text-tone-info-fg cursor-default`
  if (state === 'success_recent')
    return `${base} border-tone-success-border bg-tone-success-bg text-tone-success-fg cursor-default`
  if (state === 'failed')
    return `${base} border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg cursor-default`
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

function toCompositeLabel(command: {
  readonly state: SyncCellState
  readonly issue: DashboardProcessSyncIssueVM | null
  readonly t: ReturnType<typeof useTranslation>['t']
  readonly keys: ReturnType<typeof useTranslation>['keys']
}): string {
  const baseLabel = toAriaLabel(command.state, command.t, command.keys)
  if (command.issue === null) {
    return baseLabel
  }

  return `${baseLabel}\n${command.issue.tooltip}`
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
      <div class="relative">
        <button
          type="button"
          onClick={handleClick}
          disabled={!isInteractive(props.state)}
          aria-busy={props.state === 'syncing'}
          aria-label={toCompositeLabel({
            state: props.state,
            issue: props.issue ?? null,
            t,
            keys,
          })}
          title={toCompositeLabel({
            state: props.state,
            issue: props.issue ?? null,
            t,
            keys,
          })}
          class={toButtonClasses(props.state)}
        >
          <SyncCellIcon state={props.state} />
        </button>
        <Show when={props.issue}>
          {(issue) => <SyncIssueBadge issue={issue()} />}
        </Show>
      </div>
    </div>
  )
}
