import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

export function AlertsList(props: { alerts: readonly AlertDisplayVM[] }): JSX.Element {
  return (
    <div class="gap-1 flex flex-col">
      <For each={props.alerts}>
        {(alert) => (
          <li class="flex gap-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1.5 list-none">
            <AlertIcon type={alert.type} />
            <div class="flex-1 min-w-0">
              <p class="text-[11px] leading-tight text-slate-600">{alert.message}</p>
              <p class="mt-0.5 text-[9px] tabular-nums text-slate-400">{alert.timestamp}</p>
            </div>
          </li>
        )}
      </For>
    </div>
  )
}
