import { Check } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { FilterControlOption } from '~/modules/process/ui/components/unified/FilterControlOption'

function CheckboxIndicator(props: { readonly checked: boolean }): JSX.Element {
  return (
    <span
      class={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border border-slate-300 ${
        props.checked ? 'bg-blue-600 text-white' : 'bg-white'
      }`}
      aria-hidden="true"
    >
      <Show when={props.checked}>
        <Check class="w-2.5 h-2.5" />
      </Show>
    </span>
  )
}

export function MultiSelectOptionsList<T extends string>(props: {
  readonly options: readonly FilterControlOption<T>[]
  readonly isSelected: (value: T) => boolean
  readonly onToggle: (value: T) => void
}): JSX.Element {
  return (
    <ul class="max-h-56 overflow-y-auto p-1">
      <For each={props.options}>
        {(option) => (
          <li>
            <button
              type="button"
              class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-md-ui transition-colors ${
                props.isSelected(option.value)
                  ? 'bg-slate-100 text-slate-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => props.onToggle(option.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') props.onToggle(option.value)
              }}
            >
              <CheckboxIndicator checked={props.isSelected(option.value)} />
              <span class="min-w-0 flex-1 truncate">{option.label}</span>
              <span class="shrink-0 tabular-nums text-xs-ui text-slate-400">{option.count}</span>
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
