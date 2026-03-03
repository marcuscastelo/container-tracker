import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { CopyButton } from '~/shared/ui/CopyButton'

function etaChipClass(tone: ContainerDetailVM['etaChipVm']['tone'], selected: boolean): string {
  if (selected) {
    return 'bg-slate-600/60 text-slate-100'
  }

  switch (tone) {
    case 'positive':
      return 'bg-emerald-50 text-emerald-700'
    case 'informative':
      return 'bg-blue-50 text-blue-700'
    case 'warning':
      return 'bg-amber-50 text-amber-700'
    default:
      return 'bg-slate-50 text-slate-500'
  }
}

export function ContainerSelector(props: {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <div class="px-2.5 py-1">
      <div class="flex flex-wrap gap-1">
        <For each={props.containers}>
          {(container) =>
            (() => {
              const selected = () => String(props.selectedId) === String(container.id)
              const etaLabel = () => {
                return toContainerEtaChipLabel(container.etaChipVm, {
                  arrived: t(keys.shipmentView.operational.chips.etaArrived),
                  expectedPrefix: t(keys.shipmentView.operational.chips.etaExpected),
                  delayed: t(keys.shipmentView.operational.header.selectedExpectedDelayed),
                  missing: t(keys.shipmentView.operational.chips.etaMissing),
                })
              }

              return (
                <div
                  data-testid={`container-card-${container.id}`}
                  class={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                    selected()
                      ? 'border-slate-600 bg-slate-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => props.onSelect(container.id)}
                      class="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <div class="flex items-center gap-1">
                        <span class="font-semibold tracking-wide text-[11px] leading-tight">
                          {container.number}
                        </span>
                        <span
                          data-testid={`container-eta-chip-${container.id}`}
                          class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${etaChipClass(
                            container.etaChipVm.tone,
                            selected(),
                          )}`}
                        >
                          {etaLabel()}
                        </span>
                        {container.tsChipVm.visible ? (
                          <span
                            data-testid={`container-int-chip-${container.id}`}
                            class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${
                              selected()
                                ? 'bg-slate-600/60 text-slate-200'
                                : 'bg-slate-100 text-slate-400'
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
                            data-testid={`container-data-chip-${container.id}`}
                            class={`inline-flex rounded px-1 py-px text-[9px] font-medium leading-none ${
                              selected()
                                ? 'bg-slate-600/60 text-slate-200'
                                : 'bg-amber-50 text-amber-600'
                            }`}
                          >
                            {t(keys.shipmentView.operational.chips.dataIssue)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                    <CopyButton
                      text={container.number}
                      title={t(keys.process.containerSelector.copyContainerNumber)}
                      class="inline-flex shrink-0"
                    />
                  </div>
                </div>
              )
            })()
          }
        </For>
      </div>
    </div>
  )
}
