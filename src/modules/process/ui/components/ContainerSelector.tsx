import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { toContainerEtaChipLabel } from '~/modules/process/ui/utils/eta-labels'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { CopyButton } from '~/shared/ui/CopyButton'

function etaChipClass(tone: ContainerDetailVM['etaChipVm']['tone'], selected: boolean): string {
  if (selected) {
    return 'bg-slate-600 text-white'
  }

  switch (tone) {
    case 'positive':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'informative':
      return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'warning':
      return 'bg-amber-50 text-amber-700 border border-amber-200'
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200'
  }
}

export function ContainerSelector(props: {
  containers: readonly ContainerDetailVM[]
  selectedId: string
  onSelect: (id: string) => void
}): JSX.Element {
  const { t, keys } = useTranslation()
  return (
    <div class="px-3 py-2">
      <div class="flex flex-wrap gap-1.5">
        <For each={props.containers}>
          {(container) =>
            (() => {
              // Coerce to string to avoid type-mismatch between id types (number | string)
              // Make selected reactive by using a getter so it updates when props change
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
                  class={`rounded border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    selected()
                      ? 'border-slate-700 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div class="flex items-start gap-1.5">
                    <button
                      type="button"
                      onClick={() => props.onSelect(container.id)}
                      class="min-w-0 flex-1 text-left"
                    >
                      <div class="flex items-center gap-1.5">
                        <span class="font-semibold tracking-wide">{container.number}</span>
                      </div>
                      <div class="mt-0.5 flex items-center gap-1">
                        <span
                          data-testid={`container-eta-chip-${container.id}`}
                          class={`inline-flex rounded px-1.5 py-px text-[10px] font-medium leading-tight ${etaChipClass(
                            container.etaChipVm.tone,
                            selected(),
                          )}`}
                        >
                          {etaLabel()}
                        </span>
                        {container.tsChipVm.visible ? (
                          <span
                            data-testid={`container-int-chip-${container.id}`}
                            class={`inline-flex rounded px-1.5 py-px text-[10px] font-medium leading-tight ${
                              selected()
                                ? 'bg-slate-600 text-white'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
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
                            class={`inline-flex rounded px-1.5 py-px text-[10px] font-medium leading-tight ${
                              selected()
                                ? 'bg-slate-600 text-white'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
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
                      class="mt-0.5 inline-flex shrink-0"
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
