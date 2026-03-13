import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'
import { ProcessAlertGroup } from '~/shared/ui/navbar-alerts/ProcessAlertGroup'

type NavbarAlertsPanelProps = {
  readonly totalAlerts: number
  readonly processes: readonly NavbarProcessAlertGroupVM[]
  readonly loading: boolean
  readonly error?: string
  readonly onRetry: () => void
  readonly onClose: () => void
  readonly onOpenDashboard: () => void
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

export function NavbarAlertsPanel(props: NavbarAlertsPanelProps): JSX.Element {
  const { t, keys } = useTranslation()
  const hasProcesses = () => props.processes.length > 0
  const shouldShowInitialLoading = () => props.loading && props.processes.length === 0 && !props.error

  return (
    <>
      <div
        class="fixed inset-0 z-40 bg-ring/35 backdrop-blur-sm min-[1024px]:hidden"
        role="button"
        tabIndex={-1}
        aria-label={t(keys.header.alertsPanel.close)}
        onClick={() => props.onClose()}
      />

      <section class="fixed inset-0 z-50 flex flex-col bg-surface min-[1024px]:absolute min-[1024px]:inset-auto min-[1024px]:right-0 min-[1024px]:top-full min-[1024px]:z-20 min-[1024px]:mt-2 min-[1024px]:max-h-[72vh] min-[1024px]:w-[min(92vw,640px)] min-[1024px]:rounded-xl min-[1024px]:border min-[1024px]:border-border min-[1024px]:bg-surface-elevated min-[1024px]:shadow-2xl">
        <header class="flex items-start justify-between gap-2 border-b border-border bg-surface px-3 py-2.5">
          <div class="min-w-0">
            <p class="text-sm-ui font-semibold text-foreground">
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
              class="inline-flex h-7 items-center justify-center rounded border border-border bg-surface px-2 text-xs-ui font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {t(keys.header.alertsPanel.openDashboard)}
            </button>
            <button
              type="button"
              onClick={() => props.onClose()}
              class="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-surface text-text-muted transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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

        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
          <Show
            when={!shouldShowInitialLoading()}
            fallback={
              <div class="space-y-2">
                <PanelSkeleton />
              </div>
            }
          >
            <Show
              when={!props.error}
              fallback={
                <div class="space-y-2 rounded-lg border border-tone-danger-border bg-tone-danger-bg p-3">
                  <p class="text-sm-ui font-medium text-tone-danger-fg">
                    {t(keys.header.alertsPanel.error)}
                  </p>
                  <button
                    type="button"
                    onClick={() => props.onRetry()}
                    class="inline-flex h-7 items-center justify-center rounded border border-tone-danger-border bg-surface px-2 text-xs-ui font-medium text-tone-danger-fg transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {t(keys.header.alertsPanel.retry)}
                  </button>
                </div>
              }
            >
              <Show
                when={hasProcesses()}
                fallback={
                  <div class="rounded-lg border border-border bg-surface p-3 text-sm-ui text-text-muted">
                    {t(keys.header.alertsPanel.empty)}
                  </div>
                }
              >
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
              </Show>
            </Show>
          </Show>
        </div>
      </section>
    </>
  )
}
