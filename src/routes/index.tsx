import { SearchOverlay } from '~/capabilities/search/ui/SearchOverlay'
import { Dashboard } from '~/modules/process/ui/screens/DashboardScreen'

export default function IndexPage() {
  return <Dashboard searchSlot={<SearchOverlay />} />
}
