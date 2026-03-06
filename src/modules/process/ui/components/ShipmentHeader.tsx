import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { ArrowIcon } from '~/modules/process/ui/components/Icons'
import {
  resolveProcessSyncHeaderMode,
  toContainerSyncLabel,
  toProcessSyncHeaderEntries,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import { trackingStatusToLabelKey } from '~/modules/process/ui/mappers/trackingStatus.ui-mapper'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'
import { StatusBadge } from '~/shared/ui/StatusBadge'

type Props = {
  data: ShipmentDetailVM
  syncNow: Date
  isRefreshing: boolean
  refreshRetry: {
    readonly current: number
    readonly total: number
  } | null
  refreshHint: string | null
  activeAlertCount: number
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
  readonly label: string
  readonly refreshingLabel: string
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
      <Show when={open()}>
        <InternalIdPopover
          message={props.message}
          ctaLabel={props.ctaLabel}
          onOpenReference={() => {
            props.onOpenReference()
            setOpen(false)
          }}
        />
      </Show>
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
    <Show
      when={props.spinning}
      fallback={
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <title>{props.title}</title>
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v6h6M20 20v-6h-6"
          />
        </svg>
      }
    >
      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <title>{props.title}</title>
        <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
        <path d="M22 12a10 10 0 00-10-10" stroke-width="2" stroke-linecap="round" />
      </svg>
    </Show>
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

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 min-w-[110px] md:min-w-[120px] justify-center ${
        props.isRefreshing ? 'opacity-80 pointer-events-none' : ''
      }`}
      title={props.title}
      aria-busy={props.isRefreshing}
      disabled={props.isRefreshing}
    >
      <RefreshIcon spinning={props.isRefreshing} title={props.title} />
      <span>{props.isRefreshing ? props.refreshingLabel : props.label}</span>
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

function SyncSeparator(props: { readonly visible: boolean }): JSX.Element | null {
  return (
    <Show when={props.visible}>
      <span class="text-slate-300">•</span>
    </Show>
  )
}

function ProcessEtaSummary(props: {
  readonly processEtaSecondaryVm: ShipmentDetailVM['processEtaSecondaryVm']
  readonly processEtaTitle: string
  readonly noEta: string
  readonly incomplete: string
}): JSX.Element {
  return (
    <Show when={props.processEtaSecondaryVm.visible}>
      <div
        data-testid="process-eta-summary"
        class="inline-flex items-center gap-1 text-micro text-slate-400"
      >
        <span class="font-medium">{props.processEtaTitle}:</span>
        <span data-testid="process-eta-date" class="text-label font-bold text-slate-800">
          {props.processEtaSecondaryVm.date ?? props.noEta}
        </span>
        <span data-testid="process-eta-coverage" class="tabular-nums text-slate-400">
          ({props.processEtaSecondaryVm.withEta}/{props.processEtaSecondaryVm.total})
        </span>
        <Show when={props.processEtaSecondaryVm.incomplete}>
          <span
            data-testid="process-eta-incomplete"
            class="rounded bg-slate-100/80 px-1 py-px text-[9px] font-medium text-slate-400"
          >
            {props.incomplete}
          </span>
        </Show>
      </div>
    </Show>
  )
}

function toCarrierDisplay(carrier: string | null): string | null {
  if (carrier === null) return null
  const normalized = carrier.trim()
  if (normalized.length === 0) return null
  return normalized.toUpperCase()
}

export function ShipmentHeader(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const [showUnknownCarrierDialog, setShowUnknownCarrierDialog] = createSignal(false)
  const syncEntries = createMemo(() =>
    toProcessSyncHeaderEntries({
      containers: props.data.containers,
      processCarrier: props.data.carrier,
    }),
  )
  const syncHeaderPrefix = createMemo(() =>
    resolveProcessSyncHeaderMode(syncEntries()) === 'syncing'
      ? t(keys.shipmentView.sync.headerSyncingPrefix)
      : t(keys.shipmentView.sync.headerUpdatedPrefix),
  )

  const toSyncEntryLabel = (entry: ReturnType<typeof syncEntries>[number]): string => {
    const carrierDisplay = toCarrierDisplay(entry.carrier)
    const containerLabel = carrierDisplay
      ? `${entry.containerNumber} (${carrierDisplay})`
      : entry.containerNumber
    const syncLabel = toContainerSyncLabel(
      entry.sync,
      {
        syncing: t(keys.shipmentView.sync.syncing),
        never: t(keys.shipmentView.sync.never),
        updatedUnknownTime: t(keys.shipmentView.sync.updatedUnknownTime),
        failedUnknownTime: t(keys.shipmentView.sync.failedUnknownTime),
        updated: (relative: string) => t(keys.shipmentView.sync.updated, { relative }),
        failed: (relative: string) => t(keys.shipmentView.sync.failed, { relative }),
      },
      {
        now: props.syncNow,
        locale: locale(),
      },
    )

    return `${containerLabel} ${syncLabel}`
  }

  return (
    <section class="mb-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5">
      {/* Row 1: Process + Status + Carrier + Actions */}
      <div class="flex flex-wrap items-center justify-between gap-1.5 sm:gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <h1 class="truncate text-sm font-bold text-slate-900 sm:text-base leading-tight">
            {t(keys.shipmentView.header)} {props.data.processRef}
            <Show when={!props.data.reference}>
              <InternalIdHint
                message={t(keys.shipmentView.internalIdMessage)}
                ctaLabel={t(keys.shipmentView.internalIdCTA)}
                onOpenReference={() => props.onOpenEdit('reference')}
              />
            </Show>
          </h1>
          <span class="hidden text-label text-slate-400/80 sm:inline-flex sm:items-center sm:gap-0.5">
            {props.data.origin}
            <ArrowIcon />
            {props.data.destination}
          </span>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <StatusBadge
            variant={props.data.status}
            label={t(trackingStatusToLabelKey(keys, props.data.statusCode))}
          />
          <span class="text-micro font-semibold uppercase tracking-wider text-slate-400">
            {props.data.carrier ?? '—'}
          </span>

          <div class="flex items-center gap-0.5 border-l border-slate-200 pl-1.5 ml-0.5">
            <RefreshButton
              isRefreshing={props.isRefreshing}
              carrier={props.data.carrier}
              title={t(keys.shipmentView.actions.refresh)}
              label={t(keys.shipmentView.actions.refresh)}
              refreshingLabel={t(keys.shipmentView.actions.refreshing)}
              onTriggerRefresh={props.onTriggerRefresh}
              onUnknownCarrier={() => setShowUnknownCarrierDialog(true)}
            />
            <Show when={props.isRefreshing ? props.refreshRetry : null}>
              {(refreshRetry) => (
                <span class="text-micro text-slate-500">
                  {t(keys.shipmentView.refreshRetry, {
                    current: refreshRetry().current,
                    total: refreshRetry().total,
                  })}
                </span>
              )}
            </Show>
            <Show when={props.isRefreshing ? null : props.refreshHint}>
              {(refreshHint) => <span class="text-micro text-slate-500">{refreshHint()}</span>}
            </Show>

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

      <Show when={syncEntries().length > 0}>
        <div class="mt-1 flex flex-wrap items-center gap-1 text-micro text-slate-500">
          <span data-testid="process-sync-prefix" class="font-medium text-slate-400">
            {syncHeaderPrefix()}
          </span>
          <For each={syncEntries()}>
            {(entry, index) => (
              <>
                <span data-testid={`process-sync-item-${entry.containerNumber}`}>
                  {toSyncEntryLabel(entry)}
                </span>
                <SyncSeparator visible={index() < syncEntries().length - 1} />
              </>
            )}
          </For>
        </div>
      </Show>

      {/* Row 2: Process-level ETA summary + containers/alerts count */}
      <div class="mt-1.5 flex items-center gap-2 flex-wrap">
        <ProcessEtaSummary
          processEtaSecondaryVm={props.data.processEtaSecondaryVm}
          processEtaTitle={t(keys.shipmentView.operational.header.processEtaTitle)}
          noEta={t(keys.shipmentView.operational.header.noEta)}
          incomplete={t(keys.shipmentView.operational.header.incomplete)}
        />
        <div class="inline-flex items-center gap-2 text-micro text-slate-400">
          <span>
            <span class="font-medium">{t(keys.shipmentView.containers.title)}:</span>{' '}
            <span class="text-slate-500">{props.data.containers.length}</span>
          </span>
          <Show when={props.activeAlertCount > 0}>
            <span>
              <span class="font-medium">{t(keys.shipmentView.alerts.title)}:</span>{' '}
              <span class="text-slate-500">{props.activeAlertCount}</span>
            </span>
          </Show>
        </div>
      </div>
    </section>
  )
}
