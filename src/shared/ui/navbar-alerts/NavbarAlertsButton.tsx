import clsx from 'clsx'
import { createEffect, type JSX, onCleanup, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { NavbarAlertsPanel } from '~/shared/ui/navbar-alerts/NavbarAlertsPanel'
import { useNavbarAlertsButtonController } from '~/shared/ui/navbar-alerts/useNavbarAlertsButtonController'

export function NavbarAlertsButton(): JSX.Element {
  const { t, keys } = useTranslation()
  const controller = useNavbarAlertsButtonController()
  const panelId = 'navbar-alerts-panel'
  let rootRef: HTMLDivElement | undefined

  createEffect(() => {
    if (!controller.isOpen()) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      controller.closePanel()
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef?.contains(target)) return
      controller.closePanel()
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleDocumentPointerDown)

    onCleanup(() => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleDocumentPointerDown)
    })
  })

  return (
    <div ref={rootRef} class="relative flex items-center">
      <button
        type="button"
        onClick={controller.togglePanel}
        aria-haspopup="dialog"
        aria-expanded={controller.isOpen()}
        aria-controls={panelId}
        aria-label={t(keys.header.alertsBadge, { count: controller.totalAlerts() })}
        title={controller.buttonTitle()}
        class={clsx(
          'inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs-ui font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          {
            'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg hover:border-tone-danger-strong':
              controller.totalAlerts() > 0,
            'border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-muted':
              controller.totalAlerts() === 0,
          },
        )}
      >
        <svg
          class="h-3.5 w-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>{controller.totalAlerts()}</span>
        <span class="hidden min-[1280px]:inline">{t(keys.header.alertsLabel)}</span>
      </button>

      <Show when={controller.isOpen()}>
        <NavbarAlertsPanel
          panelId={panelId}
          totalAlerts={controller.totalAlerts()}
          processes={controller.state().processes}
          loading={controller.state().loading}
          error={controller.state().error}
          onRetry={controller.retry}
          onClose={controller.closePanel}
          onOpenDashboard={controller.openDashboard}
          onOpenProcess={controller.openProcess}
          onOpenContainer={controller.openContainer}
        />
      </Show>
    </div>
  )
}
