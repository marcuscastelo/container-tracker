import { useParams } from '@solidjs/router'
import { GlobalSearchOverlay } from '~/capabilities/search/ui/GlobalSearchOverlay'
import { ShipmentPage } from '~/modules/process/ui/screens/shipment/ShipmentPage'

export default function ShipmentRoute() {
  const params = useParams<{ id: string }>()
  return <ShipmentPage params={params} searchSlot={<GlobalSearchOverlay />} />
}
