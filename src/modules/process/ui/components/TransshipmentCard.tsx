import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'

type Props = {
  readonly selectedContainer: ContainerDetailVM | null
}

export function TransshipmentCard(props: Props): JSX.Element | null {
  const { t, keys } = useTranslation()

  const transshipment = () => props.selectedContainer?.transshipment ?? null
  const hasTransshipment = () => Boolean(transshipment()?.hasTransshipment)

  return (
    <Show when={hasTransshipment()}>
      <section data-testid="transshipment-card" class="rounded-lg border border-slate-200 bg-white">
        <div class="px-4 py-2.5">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t(keys.shipmentView.transshipment.title)}
            </h3>
            <span class="text-xs font-medium text-slate-700">
              {t(keys.shipmentView.transshipment.count, {
                count: transshipment()?.count ?? 0,
              })}
            </span>
          </div>
          <p class="mt-1 text-xs text-slate-600">
            {(transshipment()?.ports ?? []).map((port) => port.code).join(' → ')}
          </p>
          <div class="mt-1.5 flex flex-wrap gap-1">
            <For each={transshipment()?.ports ?? []}>
              {(port) => (
                <span
                  class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                  title={port.display ?? undefined}
                >
                  {port.code}
                </span>
              )}
            </For>
          </div>
        </div>
      </section>
    </Show>
  )
}
