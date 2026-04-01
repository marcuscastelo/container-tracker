import { useParams } from '@solidjs/router'
import { lazy } from 'solid-js'
import { ShipmentPage } from '~/modules/process/ui/screens/shipment/ShipmentPage'

const GlobalSearchOverlay = lazy(() =>
  import('~/capabilities/search/ui/GlobalSearchOverlay').then((mod) => ({
    default: mod.GlobalSearchOverlay,
  })),
)

export default function ShipmentRoute() {
  const params = useParams<{ id: string }>()
  return <ShipmentPage params={params} searchSlot={<GlobalSearchOverlay />} />
}
