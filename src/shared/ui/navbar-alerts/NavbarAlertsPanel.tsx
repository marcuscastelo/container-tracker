import { For, type JSX, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { ProcessAlertGroup } from '~/shared/ui/navbar-alerts/ProcessAlertGroup'

type NavbarAlertsPanelProps = {
  readonly panelId: string
  readonly totalAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupVM[]
  readonly loading: boolean
  readonly error: string | null
  readonly onRetry: () => void
  readonly onClose: () => void
  readonly onOpenDashboard: () => void
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}

type PanelHeaderProps = {
  readonly titleId: string
  readonly totalAlerts: number
  readonly onClose: () => void
  readonly onOpenDashboard: () => void
}

type PanelContentProps = {
  readonly processes: readonly NavbarProcessAlertGroupVM[]
  readonly loading: boolean
  readonly error: string | null
  readonly onRetry: () => void
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}

function PanelSkeleton(): JSX.Element {
  return (
    <div class="space-y-2">
      <div class="rounded-lg border border-border bg-surface p-2.5">
        <div class="h-4 w-36 animate-pulse rounded bg-surface-muted" />
        <div class="mt-1 h-3 w-24 animate-pulse rounded bg-surface-muted" />
        <div class="mt-1 h-3 w-40 animate-pulse rounded bg-surface-muted" />
      </div>
      <div class="rounded-lg border border-border bg-surface p-2.5">
        <div class="h-4 w-44 animate-pulse rounded bg-surface-muted" />
        <div class="mt-1 h-3 w-28 animate-pulse rounded bg-surface-muted" />
        <div class="mt-1 h-3 w-48 animate-pulse rounded bg-surface-muted" />
      </div>
    </div>
  )
}

function PanelLoadingState(): JSX.Element {
  return (
    <div class="space-y-2">
      <PanelSkeleton />
    </div>
  )
}

function PanelErrorState(props: { readonly onRetry: () => void }): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="space-y-2 rounded-lg border border-tone-danger-border bg-tone-danger-bg p-3">
      <p class="text-sm-ui font-medium text-tone-danger-fg">{t(keys.header.alertsPanel.error)}</p>
      <button
        type="button"
        onClick={() => props.onRetry()}
        class="motion-focus-surface motion-interactive inline-flex h-7 items-center justify-center rounded border border-tone-danger-border bg-surface px-2 text-xs-ui font-medium text-tone-danger-fg hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {t(keys.header.alertsPanel.retry)}
      </button>
    </div>
  )
}

function PanelEmptyState(): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="rounded-lg border border-border bg-surface p-3 text-sm-ui text-text-muted">
      {t(keys.header.alertsPanel.empty)}
    </div>
  )
}

function PanelProcessList(props: {
  readonly processes: readonly NavbarProcessAlertGroupVM[]
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}): JSX.Element {
  return (
    <div class="space-y-2.5">
      <For each={props.processes}>
        {(process) => (
          <ProcessAlertGroup
            process={process}
            onOpenProcess={props.onOpenProcess}
            onOpenContainer={props.onOpenContainer}
          />
        )}
      </For>
    </div>
  )
}

function PanelHeader(props: PanelHeaderProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <header class="flex items-start justify-between gap-2 border-b border-border bg-surface px-3 py-2.5">
      <div class="min-w-0">
        <p id={props.titleId} class="text-sm-ui font-semibold text-foreground">
          {t(keys.header.alertsPanel.title)}
        </p>
        <p class="text-xs-ui text-text-muted">{t(keys.header.alertsPanel.subtitle)}</p>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        <span class="rounded border border-tone-danger-border bg-tone-danger-bg px-1.5 py-0.5 text-micro font-semibold text-tone-danger-fg">
          {t(keys.header.alertsPanel.alertsCount, { count: props.totalAlerts })}
        </span>
        <button
          type="button"
          onClick={() => props.onOpenDashboard()}
          class="motion-focus-surface motion-interactive inline-flex h-7 items-center justify-center rounded border border-border bg-surface px-2 text-xs-ui font-medium text-foreground hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {t(keys.header.alertsPanel.openDashboard)}
        </button>
        <button
          type="button"
          onClick={() => props.onClose()}
          class="motion-focus-surface motion-interactive inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={t(keys.header.alertsPanel.close)}
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </header>
  )
}

function PanelContent(props: PanelContentProps): JSX.Element {
  const hasProcesses = () => props.processes.length > 0
  const shouldShowInitialLoading = () =>
    props.loading && props.processes.length === 0 && !props.error

  return (
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
      <Show when={!shouldShowInitialLoading()} fallback={<PanelLoadingState />}>
        <Show when={!props.error} fallback={<PanelErrorState onRetry={props.onRetry} />}>
          <Show when={hasProcesses()} fallback={<PanelEmptyState />}>
            <PanelProcessList
              processes={props.processes}
              onOpenProcess={props.onOpenProcess}
              onOpenContainer={props.onOpenContainer}
            />
          </Show>
        </Show>
      </Show>
    </div>
  )
}

export function NavbarAlertsPanel(props: NavbarAlertsPanelProps): JSX.Element {
  const { t, keys } = useTranslation()
  const titleId = () => `${props.panelId}-title`

  return (
    <>
      <button
        type="button"
        class="appearance-none border-0 fixed inset-0 z-40 bg-ring/35 backdrop-blur-sm min-[1024px]:hidden"
        aria-label={t(keys.header.alertsPanel.close)}
        onClick={() => props.onClose()}
      />

      <section
        id={props.panelId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId()}
        class="motion-overlay-surface fixed inset-0 z-50 flex flex-col bg-surface min-[1024px]:absolute min-[1024px]:inset-auto min-[1024px]:right-0 min-[1024px]:top-full min-[1024px]:z-20 min-[1024px]:mt-2 min-[1024px]:max-h-[72vh] min-[1024px]:w-[min(92vw,640px)] min-[1024px]:rounded-xl min-[1024px]:border min-[1024px]:border-border min-[1024px]:bg-surface-elevated min-[1024px]:shadow-2xl"
      >
        <PanelHeader
          titleId={titleId()}
          totalAlerts={props.totalAlerts}
          onClose={props.onClose}
          onOpenDashboard={props.onOpenDashboard}
        />
        <PanelContent
          processes={props.processes}
          loading={props.loading}
          error={props.error}
          onRetry={props.onRetry}
          onOpenProcess={props.onOpenProcess}
          onOpenContainer={props.onOpenContainer}
        />
      </section>
    </>
  )
}
