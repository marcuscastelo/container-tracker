import type { JSX } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

/**
 * Renders the warning block for the delete shipment dialog.
 *
 * Shows a destructive description, a bullet list of everything that will be
 * permanently removed, and a "cannot undo" footer.
 */
export function DeleteShipmentWarning(): JSX.Element {
  const { t, keys } = useTranslation()

  const k = keys.shipmentView.deleteShipment

  return (
    <div class="space-y-3">
      <p class="text-sm-ui text-foreground">{t(k.description)}</p>

      <ul class="list-disc space-y-1 pl-5 text-sm-ui text-foreground" aria-label={t(k.description)}>
        <li>{t(k.warningItems.shipment)}</li>
        <li>{t(k.warningItems.containers)}</li>
        <li>{t(k.warningItems.timeline)}</li>
        <li>{t(k.warningItems.carrierEvents)}</li>
        <li>{t(k.warningItems.alerts)}</li>
      </ul>

      <div class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-3 py-2">
        <p class="text-sm-ui font-semibold text-tone-danger-fg">{t(k.cannotUndo)}</p>
      </div>
    </div>
  )
}
