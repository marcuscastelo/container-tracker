import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { DashboardImporterFilterOption } from '~/modules/process/ui/viewmodels/dashboard-filter.service'

export function ImporterOptionsList(props: {
  readonly options: readonly DashboardImporterFilterOption[]
  readonly isSelected: (option: DashboardImporterFilterOption) => boolean
  readonly onSelect: (option: DashboardImporterFilterOption) => void
}): JSX.Element {
  return (
    <ul class="max-h-56 overflow-y-auto p-1">
      <For each={props.options}>
        {(option) => (
          <li>
            <button
              type="button"
              class={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-md-ui transition-colors ${
                props.isSelected(option)
                  ? 'bg-control-selected-bg text-control-selected-foreground'
                  : 'text-control-popover-foreground hover:bg-control-bg-hover'
              }`}
              onClick={() => props.onSelect(option)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') props.onSelect(option)
              }}
            >
              <span class="min-w-0 flex-1 truncate">{option.label}</span>
              <span class="shrink-0 tabular-nums text-xs-ui text-text-muted">{option.count}</span>
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
