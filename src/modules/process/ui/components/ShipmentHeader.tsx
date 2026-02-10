import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import type { ShipmentDetail } from '~/modules/process/application/processPresenter'
import { ArrowIcon } from '~/modules/process/ui/components/Icons'
import { useTranslation } from '~/shared/localization/i18n'
import { StatusBadge } from '~/shared/ui'
import { Dialog } from '~/shared/ui/Dialog'

type Props = {
  data: ShipmentDetail
  isRefreshing: boolean
  onTriggerRefresh: () => void
  // when called with 'reference' or 'carrier', the parent should focus that field when opening the edit dialog
  onOpenEdit: (focus?: 'reference' | 'carrier' | null | undefined) => void
}

export function ShipmentHeader(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const [showInternalIdInfo, setShowInternalIdInfo] = createSignal(false)
  const [showUnknownCarrierDialog, setShowUnknownCarrierDialog] = createSignal(false)
  return (
    <section class="mb-6 rounded-lg border border-slate-200 bg-white p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">
            {t(keys.shipmentView.header)} {props.data.processRef}
            <Show when={!props.data.reference}>
              <span class="relative inline-block ml-2">
                <button
                  type="button"
                  aria-label={t(keys.shipmentView.internalIdMessage)}
                  class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-blue-600 text-xs font-medium hover:bg-slate-200 animate-pulse hover:cursor-pointer hover:scale-110 transition-transform"
                  onClick={() => setShowInternalIdInfo((s) => !s)}
                >
                  i
                </button>

                <div
                  class={clsx(
                    'absolute right-0 z-10 mt-2 w-64 rounded border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg',
                    { hidden: !showInternalIdInfo() },
                  )}
                  role="dialog"
                  aria-hidden={!showInternalIdInfo()}
                >
                  <p class="text-xs text-slate-700">{t(keys.shipmentView.internalIdMessage)}</p>

                  <div class="mt-2 text-right">
                    <button
                      type="button"
                      class="rounded outline bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        props.onOpenEdit('reference')
                        setShowInternalIdInfo(false)
                      }}
                    >
                      {t(keys.shipmentView.internalIdCTA)}
                    </button>
                  </div>
                </div>
              </span>
            </Show>
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
            <StatusBadge variant={props.data.status} label={props.data.statusLabel} />
          </div>
          <div class="text-center">
            <p class="text-xs uppercase text-slate-500">{t(keys.shipmentView.carrier)}</p>
            <p class="text-sm font-medium text-slate-900">{props.data.carrier ?? '—'}</p>
          </div>
          <div class="text-right">
            <p class="text-xs uppercase text-slate-500">{t(keys.shipmentView.eta)}</p>
            <p class="text-sm font-medium text-slate-900">
              {props.data.eta ?? t(keys.shipmentView.etaMissing)}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // If carrier is explicitly 'unknown', open an informative modal and suggest editing
                if (props.data.carrier === 'unknown') {
                  setShowUnknownCarrierDialog(true)
                  return
                }
                props.onTriggerRefresh()
              }}
              class={`rounded-md p-2 text-slate-500 hover:bg-slate-100 ${props.isRefreshing ? 'opacity-60 pointer-events-none' : ''
                }`}
              title="Refresh"
              aria-busy={props.isRefreshing}
              disabled={props.isRefreshing}
            >
              {props.isRefreshing ? (
                <svg
                  class="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <title>Refresh</title>
                  <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
                  <path d="M22 12a10 10 0 00-10-10" stroke-width="2" stroke-linecap="round" />
                </svg>
              ) : (
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <title>Refresh</title>
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v6h6M20 20v-6h-6"
                  />
                </svg>
              )}
            </button>

            <Dialog
              open={showUnknownCarrierDialog()}
              onClose={() => setShowUnknownCarrierDialog(false)}
              title={t(keys.shipmentView.refreshCarrierUnknownTitle)}
              description={t(keys.shipmentView.refreshCarrierUnknownMessage)}
            >
              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  class="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  onClick={() => setShowUnknownCarrierDialog(false)}
                >
                  {t(keys.shipmentView.refreshCarrierUnknownCancelCTA)}
                </button>
                <button
                  type="button"
                  class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => {
                    setShowUnknownCarrierDialog(false)
                    props.onOpenEdit('carrier')
                  }}
                >
                  {t(keys.shipmentView.refreshCarrierUnknownEditCTA)}
                </button>
              </div>
            </Dialog>

            <button
              type="button"
              onClick={() => props.onOpenEdit()}
              class="rounded-md p-2 text-slate-500 hover:bg-slate-100"
              title="Edit"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <title>Edit</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536M4 20l7.5-1.5L20 9l-7.5-7.5L4 20z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
