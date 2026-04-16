import { lazy } from 'solid-js'
import { Dashboard } from '~/modules/process/ui/screens/DashboardScreen'

const GlobalSearchOverlay = lazy(() =>
  import('~/capabilities/search/ui/GlobalSearchOverlay').then((mod) => ({
    default: mod.GlobalSearchOverlay,
  })),
)

export default function IndexPage() {
  return <Dashboard searchSlot={<GlobalSearchOverlay />} />
}
