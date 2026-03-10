import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ArrowIcon } from '~/modules/process/ui/components/Icons'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  /** Shipment / process reference displayed as the identifier */
  readonly processRef: string
  /** Number of containers associated with the shipment */
  readonly containerCount: number
  /** Carrier code or name (null when unknown) */
  readonly carrier: string | null | undefined
  /** Origin location */
  readonly origin: string
  /** Destination location */
  readonly destination: string
}

/**
 * Contextual summary card rendered inside the delete dialog so the operator
 * can visually confirm they are about to delete the correct shipment.
 */
export function DeleteShipmentSummary(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const k = keys.shipmentView.deleteShipment

  return (
    <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm-ui">
        <dt class="font-medium text-slate-500">{t(k.summaryShipment)}</dt>
        <dd class="font-semibold text-slate-900">{props.processRef}</dd>

        <dt class="font-medium text-slate-500">{t(k.summaryContainers)}</dt>
        <dd class="text-slate-700">{props.containerCount}</dd>

        <Show when={props.carrier}>
          {(carrier) => (
            <>
              <dt class="font-medium text-slate-500">{t(k.summaryCarrier)}</dt>
              <dd class="text-slate-700">{carrier()}</dd>
            </>
          )}
        </Show>

        <dt class="font-medium text-slate-500">{t(k.summaryRoute)}</dt>
        <dd class="inline-flex items-center gap-1 text-slate-700">
          {props.origin}
          <ArrowIcon />
          {props.destination}
        </dd>
      </dl>
    </div>
  )
}
