import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { AlertsList } from '~/modules/process/ui/components/AlertsList'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Panel } from '~/shared/ui/layout/Panel'
import { Stack } from '~/shared/ui/layout/Stack'

type Props = {
  alerts: readonly AlertDisplayVM[]
}

export function AlertsPanel(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const panelTitle = () => {
    const count = props.alerts.length
    if (count === 0) return t(keys.shipmentView.alerts.title)
    return `${t(keys.shipmentView.alerts.title)} (${count})`
  }
  return (
    <Panel title={panelTitle()} bodyClass="py-0">
      <Stack gap="xs">
        <Show
          when={props.alerts.length > 0}
          fallback={
            <p class="py-2 text-center text-[10px] text-slate-300">
              {t(keys.shipmentView.alerts.empty)}
            </p>
          }
        >
          <ul class="space-y-0.5 px-2.5 py-1">
            <AlertsList alerts={props.alerts} />
          </ul>
        </Show>
      </Stack>
    </Panel>
  )
}
