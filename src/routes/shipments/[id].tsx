import { useParams } from '@solidjs/router'
import { ShipmentView } from '~/modules/shipment'

export default function ShipmentPage() {
  const params = useParams<{ id: string }>()
  return <ShipmentView params={{ id: params.id }} />
}
