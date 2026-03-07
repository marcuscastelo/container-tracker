import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { FilterControlOption } from './FilterControlOption'
import { ChevronDownIcon } from './Icons'

export default function MultiSelectChipDropdown<T extends string>(props: {
  readonly label: string
  readonly allLabel: string
  readonly emptyLabel: string
  readonly testId: string
  readonly selectedValues: readonly T[]
  readonly options: readonly FilterControlOption<T>[]
  readonly onToggle: (value: T) => void
  readonly toSelectedCountLabel: (count: number) => string
}): JSX.Element {
  const selectedCount = () => props.selectedValues.length
  const isSelected = (value: T): boolean => props.selectedValues.some((v) => v === value)

  const hasSelection = () => selectedCount() > 0

  const chipLabel = () => {
    if (props.options.length === 0) return props.label
    if (!hasSelection()) return props.label
    if (selectedCount() === 1) {
      const selected = props.options.find((o) => isSelected(o.value))
      return selected ? `${props.label}: ${selected.label}` : props.label
    }
    return `${props.label}: ${props.toSelectedCountLabel(selectedCount())}`
  }

  return (
    <details class="group relative" data-testid={props.testId}>
      <summary
        class={`inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors select-none ${
          hasSelection()
            ? 'border-slate-400 bg-slate-50 text-slate-800'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
        }`}
      >
        <span class="truncate">{chipLabel()}</span>
        <ChevronDownIcon />
      </summary>

      <div class="absolute left-0 top-full z-20 mt-1 min-w-55 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
        {props.options.length === 0 ? (
          <p class="px-3 py-2 text-[13px] text-slate-500">{props.emptyLabel}</p>
        ) : (
          <ul class="max-h-56 overflow-y-auto p-1">
            <For each={props.options}>
              {(option) => (
                <li class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    class="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={isSelected(option.value)}
                    onInput={() => props.onToggle(option.value)}
                  />
                  <span class="min-w-0 flex-1 truncate">{option.label}</span>
                  <span class="shrink-0 tabular-nums text-[11px] text-slate-400">
                    {option.count}
                  </span>
                </li>
              )}
            </For>
          </ul>
        )}
      </div>
    </details>
  )
}
