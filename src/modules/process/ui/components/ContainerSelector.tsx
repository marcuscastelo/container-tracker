import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { CopyButton } from '~/shared/ui/CopyButton'

function etaChipClass(tone: ContainerDetailVM['etaChipVm']['tone'], selected: boolean): string {
  if (selected) {
    return 'bg-slate-700 text-slate-100'
  }

  switch (tone) {
    case 'positive':
      return 'bg-emerald-100 text-emerald-800'
    case 'informative':
      return 'bg-blue-100 text-blue-800'
    case 'warning':
      return 'bg-amber-100 text-amber-900'
    default:
      return 'bg-slate-200 text-slate-700'
  }
}

export function ContainerSelector(props: {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <div class="p-4">
      <div class="flex flex-wrap gap-2">
        <For each={props.containers}>
          {(container) =>
            (() => {
              const selected = props.selectedId === container.id
              const etaLabel = () => {
                if (container.etaChipVm.state === 'UNAVAILABLE') {
                  return t(keys.shipmentView.operational.chips.etaMissing)
                }

                const datePart = container.etaChipVm.date ? ` ${container.etaChipVm.date}` : ''
                if (container.etaChipVm.state === 'ACTUAL') {
                  return `${t(keys.shipmentView.operational.chips.etaArrived)}${datePart}`
                }

                if (container.etaChipVm.state === 'EXPIRED_EXPECTED') {
                  return `${t(keys.shipmentView.operational.chips.etaExpected)}${datePart} ${t(keys.shipmentView.operational.chips.etaDelayedSuffix)}`
                }

                return `${t(keys.shipmentView.operational.chips.etaExpected)}${datePart}`
              }

              return (
                <button
                  type="button"
                  onClick={() => props.onSelect(container.id)}
                  class={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <div class="flex items-center gap-2">
                    <span class="truncate">{container.number}</span>
                    <CopyButton
                      text={container.number}
                      title={t(keys.process.containerSelector.copyContainerNumber)}
                      class="inline-flex"
                    />
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      class={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${etaChipClass(
                        container.etaChipVm.tone,
                        selected,
                      )}`}
                    >
                      {etaLabel()}
                    </span>
                    {container.tsChipVm.visible ? (
                      <span
                        class={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${
                          selected ? 'bg-slate-700 text-slate-100' : 'bg-amber-100 text-amber-900'
                        }`}
                        title={container.tsChipVm.portsTooltip ?? undefined}
                      >
                        {t(keys.shipmentView.operational.chips.ts, {
                          count: container.tsChipVm.count,
                        })}
                      </span>
                    ) : null}
                    {container.dataIssueChipVm.visible ? (
                      <span
                        class={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${
                          selected ? 'bg-slate-700 text-slate-100' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {t(keys.shipmentView.operational.chips.dataIssue)}
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })()
          }
        </For>
      </div>
    </div>
  )
}
