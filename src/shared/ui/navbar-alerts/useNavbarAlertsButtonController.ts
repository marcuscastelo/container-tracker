import { useNavigate } from '@solidjs/router'
import { createSignal } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'
import { useNavbarAlerts } from '~/shared/ui/navbar-alerts/useNavbarAlerts'
import {
  navigateToProcess,
  navigateToProcessContainer,
  type ProcessContainerNavigationState,
} from '~/shared/ui/navigation/app-navigation'

export function useNavbarAlertsButtonController() {
  const { t, keys } = useTranslation()
  const navigate = useNavigate()
  const navbarAlerts = useNavbarAlerts()
  const [isOpen, setIsOpen] = createSignal(false)
  let containerNavigationRequestCounter = 0

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

  const retry = () => {
    void navbarAlerts.refresh()
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

  return {
    isOpen,
    totalAlerts,
    state: navbarAlerts.state,
    togglePanel,
    closePanel,
    retry,
    openDashboard,
    openProcess,
    openContainer,
    buttonTitle,
  }
}
