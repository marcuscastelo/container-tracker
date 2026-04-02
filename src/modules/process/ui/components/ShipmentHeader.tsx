import { RefreshCw } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, Show } from 'solid-js'
import { DeleteShipmentDialog } from '~/modules/process/ui/components/DeleteShipmentDialog'
import { toProcessStatusBadgesDisplay } from '~/modules/process/ui/components/process-status-badges.presenter'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  data: ShipmentDetailVM
  isRefreshing: boolean
  refreshRetry: {
    readonly current: number
    readonly total: number
  } | null
  refreshHint: string | null
  onTriggerRefresh: () => void
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

type HeaderIconButtonProps = {
  readonly title: string
  readonly variant: 'default' | 'danger'
  readonly onClick: () => void
  readonly children: JSX.Element
}

function HeaderIconButton(props: HeaderIconButtonProps): JSX.Element {
  const className = () =>
    props.variant === 'danger'
      ? 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg transition-colors hover:bg-tone-danger-bg'
      : 'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground'

  return (
    <button type="button" title={props.title} onClick={() => props.onClick()} class={className()}>
      {props.children}
    </button>
  )
}

function InternalIdHint(props: InternalIdHintProps): JSX.Element {
  const [open, setOpen] = createSignal(false)

  return (
    <span class="relative inline-block align-middle">
      <button
        type="button"
        aria-label={props.message}
        class="inline-flex h-4 w-16 p-2 text-xs align-text-top italic bold text-tone-warning-fg items-center justify-center rounded-full bg-tone-warning-bg text-xs-ui font-medium animate-pulse transition-transform hover:cursor-pointer hover:scale-110 hover:bg-surface-muted"
        onClick={() => setOpen((current) => !current)}
      >
        sem ref
      </button>
      <Show when={open()}>
        <div
          class="absolute right-0 z-10 mt-2 w-64 rounded border border-border bg-surface p-3 text-sm-ui text-foreground shadow-lg"
          role="dialog"
          aria-hidden="false"
        >
          <p class="text-xs-ui text-foreground">{props.message}</p>
          <div class="mt-2 text-right">
            <button
              type="button"
              class="rounded bg-secondary px-2 py-1 text-sm-ui font-medium text-secondary-foreground outline hover:bg-surface-muted"
              onClick={() => {
                props.onOpenReference()
                setOpen(false)
              }}
            >
              {props.ctaLabel}
            </button>
          </div>
        </div>
      </Show>
    </span>
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
        class="rounded-md px-3 py-2 text-sm-ui font-medium text-text-muted hover:bg-surface-muted"
        onClick={() => props.onCancel()}
      >
        {props.cancelLabel}
      </button>
      <button
        type="button"
        class="rounded-md bg-primary px-3 py-2 text-sm-ui font-medium text-primary-foreground hover:bg-primary-hover"
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

function HeaderActions(props: {
  readonly etaLabel: string
  readonly isRefreshing: boolean
  readonly onRefresh: () => void
  readonly refreshLabel: string
  readonly editTitle: string
  readonly deleteTitle: string
  readonly onEdit: () => void
  readonly onDelete: () => void
}): JSX.Element {
  return (
    <div class="flex items-center gap-2">
      <button
        type="button"
        onClick={() => props.onRefresh()}
        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm-ui font-semibold text-foreground transition-colors hover:bg-surface-muted"
        title={props.refreshLabel}
      >
        <RefreshCw class={`h-3.5 w-3.5 ${props.isRefreshing ? 'animate-spin' : ''}`} />
        <span>{props.etaLabel}</span>
      </button>

      <HeaderIconButton title={props.editTitle} variant="default" onClick={props.onEdit}>
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <title>{props.editTitle}</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15.232 5.232l3.536 3.536M4 20l7.5-1.5L20 9l-7.5-7.5L4 20z"
          />
        </svg>
      </HeaderIconButton>

      <HeaderIconButton title={props.deleteTitle} variant="danger" onClick={props.onDelete}>
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <title>{props.deleteTitle}</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </HeaderIconButton>
    </div>
  )
}

function HeaderMeta(props: {
  readonly route: string
  readonly carrierLabel: string
  readonly statusVariant: ShipmentDetailVM['status']
  readonly statusLabel: string
}): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-2 text-sm-ui text-text-muted">
      <span class="inline-flex items-center gap-1 font-medium uppercase tracking-wide text-text-muted">
        {props.route}
      </span>
      <StatusBadge variant={props.statusVariant} label={props.statusLabel} />
      <span class="text-text-muted">{props.carrierLabel}</span>
    </div>
  )
}

export function ShipmentHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const translate = (key: string, options?: Record<string, unknown>): string =>
    options === undefined ? t(key) : t(key, options)
  const [showUnknownCarrierDialog, setShowUnknownCarrierDialog] = createSignal(false)
  const [showDeleteDialog, setShowDeleteDialog] = createSignal(false)

  const statusBadge = createMemo(
    () =>
      toProcessStatusBadgesDisplay({
        source: {
          status: props.data.status,
          statusCode: props.data.statusCode,
          statusMicrobadge: props.data.statusMicrobadge,
        },
        t: translate,
        keys,
      }).primary,
  )

  const routeLabel = createMemo(
    () => `${props.data.origin} ${String.fromCharCode(8594)} ${props.data.destination}`,
  )
  const carrierLabel = createMemo(
    () => `${t(keys.shipmentView.carrier)}: ${props.data.carrier ?? String.fromCharCode(8212)}`,
  )
  const etaLabel = createMemo(() => {
    const value = (() => {
      if (props.data.processEtaDisplayVm.kind === 'arrived') {
        return `${t(keys.shipmentView.operational.chips.etaArrived)} ${props.data.processEtaDisplayVm.date}`
      }

      if (props.data.processEtaDisplayVm.kind === 'date') {
        return props.data.processEtaDisplayVm.date
      }

      if (props.data.processEtaDisplayVm.kind === 'delivered') {
        return t(keys.tracking.status.DELIVERED)
      }

      return t(keys.shipmentView.operational.chips.etaMissing)
    })()

    return `${t(keys.shipmentView.eta)}: ${value}`
  })

  const handleRefresh = () => {
    if (props.data.carrier === 'unknown') {
      setShowUnknownCarrierDialog(true)
      return
    }
    props.onTriggerRefresh()
  }

  return (
    <section class="rounded-xl border border-border bg-surface px-4 py-4 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] sm:px-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 space-y-2">
          <h1 class="flex min-w-0 items-center gap-2 text-xl-ui font-semibold leading-tight text-foreground">
            <span class="truncate">{props.data.processRef}</span>
            <Show when={!props.data.reference}>
              <InternalIdHint
                message={t(keys.shipmentView.internalIdMessage)}
                ctaLabel={t(keys.shipmentView.internalIdCTA)}
                onOpenReference={() => props.onOpenEdit('reference')}
              />
            </Show>
          </h1>

          <HeaderMeta
            route={routeLabel()}
            statusVariant={statusBadge().variant}
            statusLabel={statusBadge().label}
            carrierLabel={carrierLabel()}
          />
        </div>

        <div class="flex shrink-0 flex-col items-end gap-1.5">
          <HeaderActions
            etaLabel={etaLabel()}
            isRefreshing={props.isRefreshing}
            onRefresh={handleRefresh}
            refreshLabel={t(keys.shipmentView.actions.refresh)}
            editTitle={t(keys.shipmentView.actions.edit)}
            deleteTitle={t(keys.shipmentView.actions.delete)}
            onEdit={() => props.onOpenEdit()}
            onDelete={() => setShowDeleteDialog(true)}
          />

          <Show when={props.isRefreshing ? props.refreshRetry : null}>
            {(refreshRetry) => (
              <span class="text-micro text-text-muted">
                {t(keys.shipmentView.refreshRetry, {
                  current: refreshRetry().current,
                  total: refreshRetry().total,
                })}
              </span>
            )}
          </Show>

          <Show when={props.isRefreshing ? null : props.refreshHint}>
            {(refreshHint) => <span class="text-micro text-text-muted">{refreshHint()}</span>}
          </Show>
        </div>
      </div>

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

      <DeleteShipmentDialog
        open={showDeleteDialog()}
        onClose={() => setShowDeleteDialog(false)}
        processId={props.data.id}
        processRef={props.data.processRef}
        containerCount={props.data.containers.length}
        carrier={props.data.carrier}
        origin={props.data.origin}
        destination={props.data.destination}
      />
    </section>
  )
}
