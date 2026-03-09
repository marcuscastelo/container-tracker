import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly data: ShipmentDetailVM
}

type InfoRowProps = {
  readonly label: string
  readonly value: string | null | undefined
}

function InfoRow(props: InfoRowProps): JSX.Element | null {
  return (
    <Show when={props.value}>
      <div class="flex items-baseline justify-between gap-2 py-0.5">
        <span class="text-micro font-medium uppercase tracking-wider text-slate-400 shrink-0">
          {props.label}
        </span>
        <span class="text-xs-ui font-medium text-slate-700 text-right truncate">{props.value}</span>
      </div>
    </Show>
  )
}

export function ShipmentInfoCard(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <Panel title={t(keys.shipmentView.shipmentInfo.title)}>
      <div class="divide-y divide-slate-50 px-2.5 py-0.5">
        <InfoRow
          label={t(keys.shipmentView.shipmentInfo.carrier)}
          value={props.data.carrier?.toUpperCase()}
        />
        <InfoRow label={t(keys.shipmentView.shipmentInfo.bl)} value={props.data.bill_of_lading} />
        <InfoRow
          label={t(keys.shipmentView.shipmentInfo.booking)}
          value={props.data.booking_number}
        />
        <InfoRow
          label={t(keys.shipmentView.shipmentInfo.importer)}
          value={props.data.importer_name}
        />
        <InfoRow
          label={t(keys.shipmentView.shipmentInfo.exporter)}
          value={props.data.exporter_name}
        />
        <InfoRow label={t(keys.shipmentView.shipmentInfo.product)} value={props.data.product} />
      </div>
    </Panel>
  )
}
