import { lazy } from 'solid-js'
import { Dashboard } from '~/modules/process/ui/screens/DashboardScreen'

const GlobalSearchOverlay = lazy(() => import('~/capabilities/search/ui/GlobalSearchOverlay'))

export default function IndexPage() {
  return <Dashboard searchSlot={<GlobalSearchOverlay />} />
}
