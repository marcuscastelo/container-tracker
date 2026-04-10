import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { PredictionHistoryHeader } from '~/modules/process/ui/components/PredictionHistoryHeader'
import { PredictionHistoryTimeline } from '~/modules/process/ui/components/PredictionHistoryTimeline'
import type { PredictionHistoryModalVM } from '~/modules/process/ui/viewmodels/prediction-history.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'

type Props = {
  readonly predictionHistory: PredictionHistoryModalVM | null
  readonly activityLabel: string
  readonly isOpen: boolean
  readonly loading?: boolean
  readonly errorMessage?: string | null
  readonly onClose: () => void
}

export function PredictionHistoryModal(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const title = createMemo(
    () => `${t(keys.shipmentView.timeline.predictionHistory.title)} — ${props.activityLabel}`,
  )

  return (
    <Dialog open={props.isOpen} onClose={props.onClose} title={title()} maxWidth="3xl">
      <div class="space-y-4">
        <Show when={props.loading === true}>
          <div class="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm-ui text-text-muted">
            {t(keys.shipmentView.loading)}
          </div>
        </Show>

        <Show when={props.loading !== true && props.errorMessage}>
          {(errorMessage) => (
            <div class="rounded-md border border-tone-danger-border bg-tone-danger-bg px-4 py-6 text-center text-sm-ui text-tone-danger-fg">
              {errorMessage()}
            </div>
          )}
        </Show>

        <Show
          when={props.loading !== true && props.errorMessage == null && props.predictionHistory}
        >
          {(predictionHistory) => (
            <div class="space-y-4">
              <PredictionHistoryHeader header={predictionHistory().header} />
              <PredictionHistoryTimeline
                items={predictionHistory().items}
                infoTooltipLabel={t(
                  keys.shipmentView.timeline.predictionHistory.tooltip.buttonLabel,
                )}
              />
            </div>
          )}
        </Show>

        <Show
          when={
            props.loading !== true && props.errorMessage == null && props.predictionHistory === null
          }
        >
          <div class="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm-ui text-text-muted">
            {t(keys.shipmentView.noEvents)}
          </div>
        </Show>

        <div class="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-md border border-border bg-surface px-4 py-2 text-sm-ui font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            {t(keys.shipmentView.timeline.predictionHistory.close)}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
