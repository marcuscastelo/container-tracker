import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { ContainerDetail } from '~/modules/process/application/shipmentReadModel'
import { useTranslation } from '~/shared/localization/i18n'
import { CopyButton } from '~/shared/ui/CopyButton'

export function ContainerSelector(props: {
  containers: readonly ContainerDetail[]
  selectedId: string
  onSelect: (id: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <div class="p-4">
      <div class="flex flex-wrap gap-2">
        <For each={props.containers}>
          {(container) => (
            <button
              type="button"
              onClick={() => props.onSelect(container.id)}
              class={`rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                props.selectedId === container.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span class="truncate">{container.number}</span>

              {/* Copy button component */}
              <CopyButton
                text={container.number}
                title={t(keys.process.containerSelector.copyContainerNumber)}
                class="inline-flex"
              />
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
