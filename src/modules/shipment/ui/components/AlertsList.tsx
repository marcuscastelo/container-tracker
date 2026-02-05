import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { AlertDisplay } from '~/modules/shipment/application/processPresenter'
import { AlertIcon } from '~/modules/shipment/ui/components/Icons'

export function AlertsList(props: { alerts: readonly AlertDisplay[] }): JSX.Element {
  return (
    <div class="p-4 gap-3 flex flex-col">
      <For each={props.alerts}>
        {(alert) => (
          <li class="flex outline outline-black/10 gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 list-none">
            <AlertIcon type={alert.type} />
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-700">{alert.message}</p>
              <p class="mt-1 text-xs text-slate-500">{alert.timestamp}</p>
            </div>
          </li>
        )}
      </For>
    </div>
  )
}
