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
  return (
    <Panel title={t(keys.shipmentView.alerts.title)} bodyClass="py-0.5">
      <Stack gap="xs">
        <Show
          when={props.alerts.length > 0}
          fallback={
            <p class="py-2 text-center text-[11px] text-slate-300">
              {t(keys.shipmentView.alerts.empty)}
            </p>
          }
        >
          <ul class="space-y-1">
            <AlertsList alerts={props.alerts} />
          </ul>
        </Show>
      </Stack>
    </Panel>
  )
}
