import { useNavigate } from '@solidjs/router'
import clsx from 'clsx'
import { createEffect, createSignal, type JSX, onCleanup, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { NavbarAlertsPanel } from '~/shared/ui/navbar-alerts/NavbarAlertsPanel'
import { useNavbarAlerts } from '~/shared/ui/navbar-alerts/useNavbarAlerts'
import {
  navigateToProcess,
  navigateToProcessContainer,
  type ProcessContainerNavigationState,
} from '~/shared/ui/navigation/app-navigation'

export function NavbarAlertsButton(): JSX.Element {
  const { t, keys } = useTranslation()
  const navigate = useNavigate()
  const navbarAlerts = useNavbarAlerts()
  const [isOpen, setIsOpen] = createSignal(false)
  const panelId = 'navbar-alerts-panel'
  let containerNavigationRequestCounter = 0
  let rootRef: HTMLDivElement | undefined

  createEffect(() => {
    if (!isOpen()) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setIsOpen(false)
    }

    const handleDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef?.contains(target)) return
      setIsOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleDocumentPointerDown)

    onCleanup(() => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleDocumentPointerDown)
    })
  })

  const totalAlerts = () => navbarAlerts.state().totalAlerts

  const togglePanel = () => {
    const nextOpenState = !isOpen()
    setIsOpen(nextOpenState)
    if (nextOpenState && (!navbarAlerts.hasResolved() || navbarAlerts.state().error !== null)) {
      void navbarAlerts.refresh()
    }
  }

  const closePanel = () => {
    setIsOpen(false)
  }

  const openDashboard = () => {
    closePanel()
    void navigate('/')
  }

  const openProcess = (processId: string) => {
    closePanel()
    navigateToProcess({
      navigate,
      processId,
    })
  }

  const openContainer = (processId: string, containerNumber: string) => {
    closePanel()

    containerNavigationRequestCounter += 1
    const navigationState: ProcessContainerNavigationState = {
      source: 'navbar-alerts',
      focusSection: 'current-status',
      revealLiveStatus: true,
      requestKey: `navbar-alert-${containerNavigationRequestCounter}`,
    }

    navigateToProcessContainer({
      navigate,
      processId,
      containerNumber,
      navigationState,
      state: navigationState,
    })
  }

  const buttonTitle = () =>
    totalAlerts() > 0
      ? t(keys.header.alertsActiveTooltip, { count: totalAlerts() })
      : t(keys.header.alertsPanel.empty)

  return (
    <div ref={rootRef} class="relative flex items-center">
      <button
        type="button"
        onClick={togglePanel}
        aria-haspopup="dialog"
        aria-expanded={isOpen()}
        aria-controls={panelId}
        aria-label={t(keys.header.alertsBadge, { count: totalAlerts() })}
        title={buttonTitle()}
        class={clsx(
          'inline-flex h-[var(--dashboard-control-height)] min-h-[var(--dashboard-control-height)] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs-ui font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          {
            'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg hover:border-tone-danger-strong':
              totalAlerts() > 0,
            'border-border bg-surface text-text-muted hover:border-border-strong hover:bg-surface-muted':
              totalAlerts() === 0,
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
        <span>{totalAlerts()}</span>
        <span class="hidden min-[1280px]:inline">{t(keys.header.alertsLabel)}</span>
      </button>

      <Show when={isOpen()}>
        <NavbarAlertsPanel
          panelId={panelId}
          totalAlerts={totalAlerts()}
          processes={navbarAlerts.state().processes}
          loading={navbarAlerts.state().loading}
          error={navbarAlerts.state().error}
          onRetry={() => {
            void navbarAlerts.refresh()
          }}
          onClose={closePanel}
          onOpenDashboard={openDashboard}
          onOpenProcess={openProcess}
          onOpenContainer={openContainer}
        />
      </Show>
    </div>
  )
}
