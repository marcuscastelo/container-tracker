import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'

export function AlertsList(props: { alerts: readonly AlertDisplayVM[] }): JSX.Element {
  function formatAge(ts: string | Date | null): string {
    if (!ts) return '—'
    const then = typeof ts === 'string' ? new Date(ts) : ts
    if (Number.isNaN(then.getTime())) return '—'
    const diff = Math.floor((Date.now() - then.getTime()) / 1000)
    if (diff < 60) return 'agora'
    const minutes = Math.floor(diff / 60)
    if (minutes < 60) return `há ${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `há ${hours}h`
    const days = Math.floor(hours / 24)
    return `há ${days}d`
  }

  return (
    <div class="gap-1 flex flex-col">
      <For each={props.alerts}>
        {(alert) => (
          <li class="flex gap-1.5 rounded border border-slate-100 bg-slate-50/60 px-2 py-1.5 list-none">
            <AlertIcon type={alert.type} />
            <div class="flex-1 min-w-0">
              <p class="text-[11px] leading-tight text-slate-600">{alert.message}</p>
              <div class="mt-0.5 flex items-center gap-3">
                <p class="text-[9px] tabular-nums text-slate-400">{alert.timestamp}</p>
                <p class="text-[9px] tabular-nums text-slate-500">{formatAge(alert.triggeredAtIso ?? null)}</p>
              </div>
            </div>
          </li>
        )}
      </For>
    </div>
  )
}
