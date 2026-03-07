import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'

export function SingleSelectOptionsList<T extends string>(props: {
  readonly allLabel: string
  readonly selectedValue: T | null
  readonly options: readonly FilterControlOption<T>[]
  readonly onSelect: (value: T | null) => void
}): JSX.Element {
  return (
    <ul class="max-h-56 overflow-y-auto p-1">
      <li>
        <button
          type="button"
          class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm-ui transition-colors ${
            props.selectedValue === null
              ? 'bg-slate-100 text-slate-800'
              : 'text-slate-700 hover:bg-slate-50'
          }`}
          onClick={() => props.onSelect(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') props.onSelect(null)
          }}
        >
          <span class="min-w-0 flex-1 truncate">{props.allLabel}</span>
        </button>
      </li>
      <For each={props.options}>
        {(option) => (
          <li>
            <button
              type="button"
              class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm-ui transition-colors ${
                props.selectedValue === option.value
                  ? 'bg-slate-100 text-slate-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => props.onSelect(option.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') props.onSelect(option.value)
              }}
            >
              <span class="min-w-0 flex-1 truncate">{option.label}</span>
              <span class="shrink-0 tabular-nums text-xs-ui text-slate-400">{option.count}</span>
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
