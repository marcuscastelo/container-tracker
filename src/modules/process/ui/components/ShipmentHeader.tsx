import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { ArrowIcon } from '~/modules/process/ui/components/Icons'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  data: ShipmentDetailVM
  selectedContainerEtaVm: ShipmentDetailVM['selectedContainerEtaVm']
  isRefreshing: boolean
  onTriggerRefresh: () => void
  // when called with 'reference' or 'carrier', the parent should focus that field when opening the edit dialog
  onOpenEdit: (focus?: 'reference' | 'carrier' | null | undefined) => void
}

type InternalIdHintProps = {
  readonly message: string
  readonly ctaLabel: string
  readonly onOpenReference: () => void
}

type UnknownCarrierDialogProps = {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly cancelLabel: string
  readonly editLabel: string
  readonly onClose: () => void
  readonly onEditCarrier: () => void
}

type RefreshButtonProps = {
  readonly isRefreshing: boolean
  readonly title: string
  readonly carrier: string | null | undefined
  readonly onTriggerRefresh: () => void
  readonly onUnknownCarrier: () => void
}

type EditButtonProps = {
  readonly title: string
  readonly onClick: () => void
}

function InternalIdHint(props: InternalIdHintProps): JSX.Element {
  const [open, setOpen] = createSignal(false)

  return (
    <span class="relative ml-2 inline-block align-middle">
      <button
        type="button"
        aria-label={props.message}
        class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-blue-600 transition-transform hover:cursor-pointer hover:scale-110 hover:bg-slate-200"
        onClick={() => setOpen((current) => !current)}
      >
        i
      </button>
      {open() ? (
        <InternalIdPopover
          message={props.message}
          ctaLabel={props.ctaLabel}
          onOpenReference={() => {
            props.onOpenReference()
            setOpen(false)
          }}
        />
      ) : null}
    </span>
  )
}

function InternalIdPopover(props: InternalIdHintProps): JSX.Element {
  return (
    <div
      class="absolute right-0 z-10 mt-2 w-64 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg"
      role="dialog"
      aria-hidden="false"
    >
      <p class="text-xs text-slate-700">{props.message}</p>
      <div class="mt-2 text-right">
        <button
          type="button"
          class="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 outline hover:bg-blue-100"
          onClick={() => props.onOpenReference()}
        >
          {props.ctaLabel}
        </button>
      </div>
    </div>
  )
}

function RefreshIcon(props: { readonly spinning: boolean; readonly title: string }): JSX.Element {
  return (
    <>
      {props.spinning ? (
        <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <title>{props.title}</title>
          <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
          <path d="M22 12a10 10 0 00-10-10" stroke-width="2" stroke-linecap="round" />
        </svg>
      ) : (
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <title>{props.title}</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v6h6M20 20v-6h-6"
          />
        </svg>
      )}
    </>
  )
}

function RefreshButton(props: RefreshButtonProps): JSX.Element {
  const handleClick = () => {
    if (props.carrier === 'unknown') {
      props.onUnknownCarrier()
      return
    }
    props.onTriggerRefresh()
  }

  const disabledClass = () => (props.isRefreshing ? 'opacity-60 pointer-events-none' : '')

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`rounded-md p-2 text-slate-500 hover:bg-slate-100 ${disabledClass()}`}
      title={props.title}
      aria-busy={props.isRefreshing}
      disabled={props.isRefreshing}
    >
      <RefreshIcon spinning={props.isRefreshing} title={props.title} />
    </button>
  )
}

function UnknownCarrierActions(props: {
  readonly cancelLabel: string
  readonly editLabel: string
  readonly onCancel: () => void
  readonly onEdit: () => void
}): JSX.Element {
  return (
    <div class="flex justify-end gap-3">
      <button
        type="button"
        class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        onClick={() => props.onCancel()}
      >
        {props.cancelLabel}
      </button>
      <button
        type="button"
        class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        onClick={() => props.onEdit()}
      >
        {props.editLabel}
      </button>
    </div>
  )
}

function UnknownCarrierDialog(props: UnknownCarrierDialogProps): JSX.Element {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
    >
      <UnknownCarrierActions
        cancelLabel={props.cancelLabel}
        editLabel={props.editLabel}
        onCancel={props.onClose}
        onEdit={props.onEditCarrier}
      />
    </Dialog>
  )
}

function EditButton(props: EditButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      class="rounded-md p-2 text-slate-500 hover:bg-slate-100"
      title={props.title}
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <title>{props.title}</title>
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15.232 5.232l3.536 3.536M4 20l7.5-1.5L20 9l-7.5-7.5L4 20z"
        />
      </svg>
    </button>
  )
}

function etaToneClass(
  tone: Exclude<NonNullable<ShipmentDetailVM['selectedContainerEtaVm']>['tone'], never>,
): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-700'
    case 'informative':
      return 'text-blue-700'
    case 'warning':
      return 'text-amber-800'
    default:
      return 'text-slate-700'
  }
}

function milestoneLabel(
  type: string,
  t: ReturnType<typeof useTranslation>['t'],
  keys: ReturnType<typeof useTranslation>['keys'],
): string {
  switch (type) {
    case 'ARRIVAL':
      return t(keys.shipmentView.operational.milestone.arrival)
    case 'DISCHARGE':
      return t(keys.shipmentView.operational.milestone.discharge)
    case 'DELIVERY':
      return t(keys.shipmentView.operational.milestone.delivery)
    default:
      return t(keys.shipmentView.operational.milestone.unknown)
  }
}

export function ShipmentHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [showUnknownCarrierDialog, setShowUnknownCarrierDialog] = createSignal(false)

  const selectedEtaTitle = () => {
    const selected = props.selectedContainerEtaVm
    if (!selected) return t(keys.shipmentView.etaMissing)
    return `${milestoneLabel(selected.type, t, keys)}: ${selected.date}`
  }

  const selectedEtaSubtitle = () => {
    const selected = props.selectedContainerEtaVm
    if (!selected) return null
    if (selected.state === 'ACTUAL') {
      return t(keys.shipmentView.operational.header.selectedActual)
    }
    if (selected.state === 'EXPIRED_EXPECTED') {
      return t(keys.shipmentView.operational.header.selectedExpectedDelayed)
    }
    return t(keys.shipmentView.operational.header.selectedExpected)
  }

  return (
    <section class="mb-6 rounded-lg border border-slate-200 bg-white p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">
            {t(keys.shipmentView.header)} {props.data.processRef}
            {props.data.reference ? null : (
              <InternalIdHint
                message={t(keys.shipmentView.internalIdMessage)}
                ctaLabel={t(keys.shipmentView.internalIdCTA)}
                onOpenReference={() => props.onOpenEdit('reference')}
              />
            )}
          </h1>
          <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <span>{props.data.origin}</span>
            <ArrowIcon />
            <span>{props.data.destination}</span>
          </div>
        </div>

        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="text-xs uppercase text-slate-500">{t(keys.shipmentView.status)}</p>
            <StatusBadge
              variant={props.data.status}
              label={t(trackingStatusToLabelKey(keys, props.data.statusCode))}
            />
          </div>
          <div class="text-center">
            <p class="text-xs uppercase text-slate-500">{t(keys.shipmentView.carrier)}</p>
            <p class="text-sm font-medium text-slate-900">{props.data.carrier ?? '—'}</p>
          </div>
          <div class="text-right">
            <p class="text-xs uppercase text-slate-500">
              {t(keys.shipmentView.operational.header.selectedEtaTitle)}
            </p>
            <p
              class={`text-sm font-medium ${
                props.selectedContainerEtaVm
                  ? etaToneClass(props.selectedContainerEtaVm.tone)
                  : 'text-slate-900'
              }`}
            >
              {selectedEtaTitle()}
            </p>
            {selectedEtaSubtitle() ? (
              <p class="text-xs text-slate-500">{selectedEtaSubtitle()}</p>
            ) : null}
          </div>
          {props.data.processEtaSecondaryVm.visible ? (
            <div class="text-right">
              <p class="text-xs uppercase text-slate-500">
                {t(keys.shipmentView.operational.header.processEtaTitle)}
              </p>
              <p class="text-sm font-medium text-slate-900">
                {props.data.processEtaSecondaryVm.date ??
                  t(keys.shipmentView.operational.header.noEta)}
              </p>
              <p class="text-xs text-slate-500">
                {props.data.processEtaSecondaryVm.withEta}/{props.data.processEtaSecondaryVm.total}
                {props.data.processEtaSecondaryVm.incomplete
                  ? ` ${t(keys.shipmentView.operational.header.incomplete)}`
                  : ''}
              </p>
            </div>
          ) : null}

          <div class="flex items-center gap-2">
            <RefreshButton
              isRefreshing={props.isRefreshing}
              carrier={props.data.carrier}
              title={t(keys.shipmentView.actions.refresh)}
              onTriggerRefresh={props.onTriggerRefresh}
              onUnknownCarrier={() => setShowUnknownCarrierDialog(true)}
            />

            <UnknownCarrierDialog
              open={showUnknownCarrierDialog()}
              onClose={() => setShowUnknownCarrierDialog(false)}
              title={t(keys.shipmentView.refreshCarrierUnknownTitle)}
              description={t(keys.shipmentView.refreshCarrierUnknownMessage)}
              cancelLabel={t(keys.shipmentView.refreshCarrierUnknownCancelCTA)}
              editLabel={t(keys.shipmentView.refreshCarrierUnknownEditCTA)}
              onEditCarrier={() => {
                setShowUnknownCarrierDialog(false)
                props.onOpenEdit('carrier')
              }}
            />

            <EditButton
              title={t(keys.shipmentView.actions.edit)}
              onClick={() => props.onOpenEdit()}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
