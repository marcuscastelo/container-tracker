import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'

type Props = {
  readonly selectedContainer: ContainerDetailVM | null
}

function portLabel(port: ContainerDetailVM['transshipment']['ports'][number]): string {
  if (!port.display) return port.code
  return `${port.code} - ${port.display}`
}

export function TransshipmentCard(props: Props): JSX.Element | null {
  const { t, keys } = useTranslation()

  const transshipment = () => props.selectedContainer?.transshipment ?? null
  const hasTransshipment = () => Boolean(transshipment()?.hasTransshipment)

  return (
    <Show when={hasTransshipment()}>
      <Panel
        title={t(keys.shipmentView.transshipment.title)}
        subtitle={props.selectedContainer?.number}
        bodyClass="p-4"
      >
        <div class="space-y-3">
          <p class="text-sm font-medium text-slate-900">
            {t(keys.shipmentView.transshipment.count, {
              count: transshipment()?.count ?? 0,
            })}
          </p>
          <div>
            <p class="text-xs uppercase text-slate-500">
              {t(keys.shipmentView.transshipment.route)}
            </p>
            <p class="mt-1 text-sm text-slate-700">
              {(transshipment()?.ports ?? []).map((port) => port.code).join(' → ')}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <For each={transshipment()?.ports ?? []}>
              {(port) => (
                <span
                  class="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700"
                  title={port.display ?? undefined}
                >
                  {portLabel(port)}
                </span>
              )}
            </For>
          </div>
        </div>
      </Panel>
    </Show>
  )
}
