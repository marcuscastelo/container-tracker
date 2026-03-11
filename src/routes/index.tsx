import { GlobalSearchOverlay } from '~/capabilities/search/ui/GlobalSearchOverlay'
import { Dashboard } from '~/modules/process/ui/screens/DashboardScreen'

export default function IndexPage() {
  return <Dashboard searchSlot={<GlobalSearchOverlay />} />
}
