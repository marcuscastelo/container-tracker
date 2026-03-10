import type { JSX } from 'solid-js'
import { createMemo } from 'solid-js'
import { ShipmentScreen } from '~/modules/process/ui/screens/shipment/ShipmentScreen'

type ShipmentPageProps = {
  readonly params: { readonly id: string }
}

export function ShipmentPage(props: ShipmentPageProps): JSX.Element {
  const processId = createMemo(() => props.params.id)
  return <ShipmentScreen processId={processId} />
}
