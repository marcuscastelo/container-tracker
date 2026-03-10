import { useParams } from '@solidjs/router'
import { ShipmentPage } from '~/modules/process/ui/screens/shipment/ShipmentPage'

export default function ShipmentRoute() {
  const params = useParams<{ id: string }>()
  return <ShipmentPage params={params} />
}
