import type { JSX } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  /** The reference string the user must type to enable the delete button */
  readonly expectedReference: string
  /** Current value of the input (controlled) */
  readonly value: string
  /** Fires on every input change */
  readonly onInput: (value: string) => void
}

/**
 * Safety-mechanism input that requires the operator to type the shipment
 * reference before the destructive action can proceed.
 *
 * The parent component is responsible for comparing `value` to
 * `expectedReference` and enabling/disabling the confirm button accordingly.
 */
export function DeleteShipmentConfirmationInput(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const k = keys.shipmentView.deleteShipment

  return (
    <div class="space-y-1.5">
      <label
        for="delete-confirm-input"
        class="block text-sm-ui font-medium text-control-foreground"
      >
        {t(k.confirmationLabel)}
      </label>
      <input
        id="delete-confirm-input"
        type="text"
        autocomplete="off"
        spellcheck={false}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder={t(k.confirmationPlaceholder, { reference: props.expectedReference })}
        class="w-full rounded-md border border-control-border bg-control-bg px-3 py-2 text-sm-ui text-control-popover-foreground placeholder:text-control-placeholder focus:border-tone-danger-strong focus:outline-none focus:ring-1 focus:ring-tone-danger-strong/40"
        aria-describedby="delete-confirm-hint"
      />
      {/* Hint for assistive technologies: mirror the placeholder text so screen readers have explicit guidance. */}
      <p id="delete-confirm-hint" class="sr-only">
        {t(k.confirmationPlaceholder, { reference: props.expectedReference })}
      </p>
    </div>
  )
}
