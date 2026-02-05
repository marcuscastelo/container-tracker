import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import type { ShipmentDetail } from '~/modules/shipment/application/processPresenter'
import { ArrowIcon } from '~/modules/shipment/ui/components/Icons'
import { StatusBadge } from '~/shared/ui'

type Props = {
  t: (k: string) => string
  keys: Record<string, string>
  data: ShipmentDetail
  isRefreshing: boolean
  onTriggerRefresh: () => void
  onOpenEdit: () => void
}

export function ShipmentHeader(props: Props): JSX.Element {
  return (
    <section class="mb-6 rounded-lg border border-slate-200 bg-white p-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">
            {props.t(props.keys.shipmentHeader)} {props.data.processRef}
          </h1>
          <div class="mt-2 flex items-center gap-2 text-sm text-slate-600">
            <span>{props.data.origin}</span>
            <ArrowIcon />
            <span>{props.data.destination}</span>
          </div>
        </div>

        <div class="flex items-center gap-6">
          <div class="text-right">
            <p class="text-xs uppercase text-slate-500">{props.t(props.keys.status)}</p>
            <StatusBadge variant={props.data.status} label={props.data.statusLabel} />
          </div>
          <div class="text-center">
            <p class="text-xs uppercase text-slate-500">{props.t(props.keys.carrier)}</p>
            <p class="text-sm font-medium text-slate-900">{props.data.carrier ?? '—'}</p>
          </div>
          <div class="text-right">
            <p class="text-xs uppercase text-slate-500">{props.t(props.keys.eta)}</p>
            <p class="text-sm font-medium text-slate-900">
              {props.data.eta ?? props.t(props.keys.etaMissing)}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => props.onTriggerRefresh()}
              class={`rounded-md p-2 text-slate-500 hover:bg-slate-100 ${
                props.isRefreshing ? 'opacity-60 pointer-events-none' : ''
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
                  <circle cx="12" cy="12" r="10" stroke-width="2" stroke-opacity="0.2" />
                  <path d="M22 12a10 10 0 00-10-10" stroke-width="2" stroke-linecap="round" />
                </svg>
              ) : (
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v6h6M20 20v-6h-6"
                  />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => props.onOpenEdit()}
              class="rounded-md p-2 text-slate-500 hover:bg-slate-100"
              title="Edit"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
