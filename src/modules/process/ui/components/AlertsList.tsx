import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

export function AlertsList(props: { alerts: readonly AlertDisplayVM[] }): JSX.Element {
  return (
    <div class="px-3 py-2 gap-1.5 flex flex-col">
      <For each={props.alerts}>
        {(alert) => (
          <li class="flex gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 list-none">
            <AlertIcon type={alert.type} />
            <div class="flex-1 min-w-0">
              <p class="text-xs text-slate-700">{alert.message}</p>
              <p class="mt-0.5 text-[10px] text-slate-400">{alert.timestamp}</p>
            </div>
          </li>
        )}
      </For>
    </div>
  )
}
