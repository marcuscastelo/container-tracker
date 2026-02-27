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
      return 'text-amber-700'
    default:
      return 'text-slate-600'
  }
}

function etaToneBgClass(
  tone: Exclude<NonNullable<ShipmentDetailVM['selectedContainerEtaVm']>['tone'], never>,
): string {
  switch (tone) {
    case 'positive':
      return 'bg-emerald-50'
    case 'informative':
      return 'bg-blue-50'
    case 'warning':
      return 'bg-amber-50'
    default:
      return 'bg-slate-50'
  }
}

export function ShipmentHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [showUnknownCarrierDialog, setShowUnknownCarrierDialog] = createSignal(false)

  const selectedEtaTitle = () => {
    const selected = props.selectedContainerEtaVm
    if (!selected) return t(keys.shipmentView.etaMissing)
    if (selected.state === 'ACTUAL') {
      return `${t(keys.shipmentView.operational.chips.etaArrived)} ${selected.date}`
    }
    return `ETA ${selected.date}`
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

  const etaBorderClass = () => {
    const selected = props.selectedContainerEtaVm
    if (!selected) return 'border-slate-200'
    switch (selected.tone) {
      case 'positive':
        return 'border-emerald-200'
      case 'warning':
        return 'border-amber-200'
      default:
        return 'border-slate-200'
    }
  }

  return (
    <section class="mb-4 rounded-lg border border-slate-200 bg-white px-5 py-4">
      {/* Row 1: Process + Status + Carrier + Actions */}
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <h1 class="truncate text-lg font-semibold text-slate-900">
            {t(keys.shipmentView.header)} {props.data.processRef}
            {props.data.reference ? null : (
              <InternalIdHint
                message={t(keys.shipmentView.internalIdMessage)}
                ctaLabel={t(keys.shipmentView.internalIdCTA)}
                onOpenReference={() => props.onOpenEdit('reference')}
              />
            )}
          </h1>
          <span class="hidden text-sm text-slate-500 sm:inline-flex sm:items-center sm:gap-1.5">
            {props.data.origin}
            <ArrowIcon />
            {props.data.destination}
          </span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <StatusBadge
            variant={props.data.status}
            label={t(trackingStatusToLabelKey(keys, props.data.statusCode))}
          />
          <span class="text-xs font-medium uppercase text-slate-500">
            {props.data.carrier ?? '—'}
          </span>

          <div class="flex items-center gap-1 border-l border-slate-200 pl-3">
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

      {/* Row 2: ETA container (primary) + ETA process (secondary) — compact bar */}
      <div class="mt-3 flex items-center gap-4 flex-wrap">
        {/* Container ETA — primary operational focus */}
        <div
          class={`inline-flex items-center gap-2 rounded border px-3 py-1.5 ${etaBorderClass()} ${
            props.selectedContainerEtaVm
              ? etaToneBgClass(props.selectedContainerEtaVm.tone)
              : 'bg-slate-50'
          }`}
        >
          <span
            class={`text-sm font-semibold ${
              props.selectedContainerEtaVm
                ? etaToneClass(props.selectedContainerEtaVm.tone)
                : 'text-slate-500'
            }`}
          >
            {selectedEtaTitle()}
          </span>
          {selectedEtaSubtitle() ? (
            <span
              class={`text-[11px] font-medium ${
                props.selectedContainerEtaVm?.state === 'EXPIRED_EXPECTED'
                  ? 'text-amber-600'
                  : 'text-slate-500'
              }`}
            >
              {selectedEtaSubtitle()}
            </span>
          ) : null}
        </div>

        {/* Process ETA — secondary */}
        {props.data.processEtaSecondaryVm.visible ? (
          <div class="inline-flex items-center gap-2 text-xs text-slate-500">
            <span class="font-medium">
              {t(keys.shipmentView.operational.header.processEtaTitle)}:
            </span>
            <span class="font-semibold text-slate-700">
              {props.data.processEtaSecondaryVm.date ??
                t(keys.shipmentView.operational.header.noEta)}
            </span>
            <span class="text-slate-400">
              ({props.data.processEtaSecondaryVm.withEta}/{props.data.processEtaSecondaryVm.total})
            </span>
            {props.data.processEtaSecondaryVm.incomplete ? (
              <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {t(keys.shipmentView.operational.header.incomplete)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
