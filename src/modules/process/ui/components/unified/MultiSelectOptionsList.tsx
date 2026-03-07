import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'

export function MultiSelectOptionsList<T extends string>(props: {
  readonly options: readonly FilterControlOption<T>[]
  readonly isSelected: (value: T) => boolean
  readonly onToggle: (value: T) => void
}): JSX.Element {
  return (
    <ul class="max-h-56 overflow-y-auto p-1">
      <For each={props.options}>
        {(option) => (
          <li class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={props.isSelected(option.value)}
              onInput={() => props.onToggle(option.value)}
            />
            <span class="min-w-0 flex-1 truncate">{option.label}</span>
            <span class="shrink-0 tabular-nums text-[11px] text-slate-400">{option.count}</span>
          </li>
        )}
      </For>
    </ul>
  )
}
