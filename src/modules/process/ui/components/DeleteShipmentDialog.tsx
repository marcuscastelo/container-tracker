import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { DeleteShipmentConfirmationInput } from '~/modules/process/ui/components/DeleteShipmentConfirmationInput'
import { DeleteShipmentSummary } from '~/modules/process/ui/components/DeleteShipmentSummary'
import { DeleteShipmentWarning } from '~/modules/process/ui/components/DeleteShipmentWarning'
import { clearPrefetchedProcessDetailById } from '~/modules/process/ui/fetchProcess'
import {
  clearDashboardPrefetchCache,
  deleteProcessRequest,
} from '~/modules/process/ui/validation/processApi.validation'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { buildDashboardHref } from '~/shared/ui/navigation/app-navigation'

type Props = {
  readonly open: boolean
  readonly onClose: () => void

  // Shipment context — used for summary + confirmation input
  readonly processId: string
  readonly processRef: string
  readonly containerCount: number
  readonly carrier: string | null | undefined
  readonly origin: string
  readonly destination: string
}

// ---------------------------------------------------------------------------
// Sub-components (dialog-internal, extracted per ui-complexity guardrail)
// ---------------------------------------------------------------------------

type ErrorBannerProps = {
  readonly title: string
  readonly message: string
}

function DeleteErrorBanner(props: ErrorBannerProps): JSX.Element {
  return (
    <div
      role="alert"
      class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-sm-ui text-tone-danger-fg"
    >
      <p class="font-semibold">{props.title}</p>
      <p>{props.message}</p>
    </div>
  )
}

type WarningIconProps = { readonly title: string }

function WarningIcon(props: WarningIconProps): JSX.Element {
  return (
    <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tone-danger-bg">
      <svg
        class="h-6 w-6 text-tone-danger-fg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.5"
        stroke="currentColor"
        aria-hidden="true"
      >
        <title>{props.title}</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
    </div>
  )
}

type ActionButtonsProps = {
  readonly cancelLabel: string
  readonly confirmLabel: string
  readonly deletingLabel: string
  readonly isDeleting: boolean
  readonly isDisabled: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function ActionButtons(props: ActionButtonsProps): JSX.Element {
  return (
    <div class="flex justify-end gap-3 border-t border-border px-6 py-4">
      <button
        type="button"
        class="rounded-md px-4 py-2 text-sm-ui font-medium text-control-foreground transition-colors hover:bg-control-bg-hover hover:text-control-foreground-strong disabled:opacity-50"
        onClick={() => props.onCancel()}
        disabled={props.isDeleting}
      >
        {props.cancelLabel}
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm-ui font-semibold text-destructive-foreground shadow-sm transition-colors hover:bg-tone-danger-strong focus:outline-none focus:ring-2 focus:ring-tone-danger-strong/40 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => props.onConfirm()}
        disabled={props.isDisabled || props.isDeleting}
        aria-busy={props.isDeleting}
      >
        <Show when={props.isDeleting}>
          <svg
            class="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
            <path d="M22 12a10 10 0 00-10-10" stroke-width="2" stroke-linecap="round" />
          </svg>
        </Show>
        {props.isDeleting ? props.deletingLabel : props.confirmLabel}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function DeleteShipmentDialog(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const navigate = useNavigate()

  const k = keys.shipmentView.deleteShipment

  const [confirmValue, setConfirmValue] = createSignal('')
  const [isDeleting, setIsDeleting] = createSignal(false)
  const [error, setError] = createSignal(false)

  const isConfirmed = () => confirmValue().trim() === props.processRef

  const handleClose = () => {
    if (isDeleting()) return
    setConfirmValue('')
    setError(false)
    props.onClose()
  }

  const handleDelete = async () => {
    if (!isConfirmed() || isDeleting()) return

    setIsDeleting(true)
    setError(false)

    try {
      await deleteProcessRequest(props.processId)
      clearPrefetchedProcessDetailById(props.processId)
      clearDashboardPrefetchCache()
      void navigate(buildDashboardHref(), { replace: true })
    } catch (_error: unknown) {
      setError(true)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={props.open} onClose={handleClose} title={t(k.title)}>
      <div class="space-y-4">
        <WarningIcon title={t(k.title)} />

        <DeleteShipmentWarning />

        <DeleteShipmentSummary
          processRef={props.processRef}
          containerCount={props.containerCount}
          carrier={props.carrier}
          origin={props.origin}
          destination={props.destination}
        />

        <DeleteShipmentConfirmationInput
          expectedReference={props.processRef}
          value={confirmValue()}
          onInput={setConfirmValue}
        />

        <Show when={error()}>
          <DeleteErrorBanner title={t(k.errorTitle)} message={t(k.errorMessage)} />
        </Show>
      </div>

      {/* Actions are rendered outside the padded content area so we use a
          negative margin to break out of Dialog's internal px-6 padding. */}
      <div class="-mx-6 -mb-4 mt-4">
        <ActionButtons
          cancelLabel={t(k.cancel)}
          confirmLabel={t(k.confirm)}
          deletingLabel={t(k.deleting)}
          isDeleting={isDeleting()}
          isDisabled={!isConfirmed()}
          onCancel={handleClose}
          onConfirm={handleDelete}
        />
      </div>
    </Dialog>
  )
}
