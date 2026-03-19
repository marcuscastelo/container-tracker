import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly data: ShipmentDetailVM
}

type InfoField = {
  readonly label: string
  readonly value: string | null | undefined
}

function InfoFieldRow(props: InfoField): JSX.Element | null {
  return (
    <Show when={props.value}>
      <div class="space-y-1">
        <p class="text-xs-ui font-medium text-text-muted">{props.label}</p>
        <p class="text-sm-ui font-semibold text-foreground">{props.value}</p>
      </div>
    </Show>
  )
}

export function ShipmentInfoCard(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const effectiveCarrierSummary = () => props.data.effectiveCarrierSummary ?? 'UNKNOWN'
  const effectiveCarrierCodes = () =>
    (props.data.effectiveCarrierCodes ?? []).map((code) => code.toUpperCase())

  const carrierModeLabel = () => {
    if (props.data.carrierMode === 'MANUAL') {
      return t(keys.shipmentView.shipmentInfo.modeManual)
    }
    return t(keys.shipmentView.shipmentInfo.modeAuto)
  }

  const effectiveCarrierLabel = () => {
    if (effectiveCarrierSummary() === 'MIXED') {
      const codes = effectiveCarrierCodes()
      if (codes.length === 0) {
        return t(keys.shipmentView.shipmentInfo.effectiveCarrierMixed)
      }
      return `${t(keys.shipmentView.shipmentInfo.effectiveCarrierMixed)} (${codes.join(', ')})`
    }
    if (effectiveCarrierSummary() === 'UNKNOWN') {
      return t(keys.shipmentView.shipmentInfo.effectiveCarrierUnknown)
    }

    const first = effectiveCarrierCodes()[0]
    if (first) return first
    return t(keys.shipmentView.shipmentInfo.effectiveCarrierUnknown)
  }

  const fields = (): readonly InfoField[] => [
    {
      label: t(keys.shipmentView.shipmentInfo.carrier),
      value: props.data.carrier?.toUpperCase(),
    },
    {
      label: t(keys.shipmentView.shipmentInfo.mode),
      value: carrierModeLabel(),
    },
    {
      label: t(keys.shipmentView.shipmentInfo.effectiveCarrier),
      value: effectiveCarrierLabel(),
    },
    {
      label: t(keys.shipmentView.shipmentInfo.bl),
      value: props.data.bill_of_lading,
    },
    {
      label: t(keys.shipmentView.shipmentInfo.importer),
      value: props.data.importer_name,
    },
    {
      label: t(keys.shipmentView.shipmentInfo.exporter),
      value: props.data.exporter_name,
    },
    {
      label: t(keys.shipmentView.shipmentInfo.product),
      value: props.data.product,
    },
    {
      label: t(keys.shipmentView.shipmentInfo.redestinationNumber),
      value: props.data.redestination_number,
    },
  ]

  return (
    <Panel title={t(keys.shipmentView.shipmentInfo.title)} class="rounded-xl" bodyClass="px-5 py-4">
      <div class="space-y-4">
        <For each={fields()}>
          {(field) => <InfoFieldRow label={field.label} value={field.value} />}
        </For>
      </div>
    </Panel>
  )
}
