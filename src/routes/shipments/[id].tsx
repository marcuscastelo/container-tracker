import { useParams } from '@solidjs/router'
import { ShipmentView } from '~/modules/process/ui/ShipmentView'

export default function ShipmentPage() {
  const params = useParams<{ id: string }>()
  return <ShipmentView params={{ id: params.id }} />
}
