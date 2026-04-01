import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { PredictionHistoryTable } from '~/modules/process/ui/components/PredictionHistoryTable'
import type { TrackingSeriesHistory } from '~/modules/tracking/features/timeline/application/projection/tracking.timeline.readmodel'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'

type Props = {
  readonly seriesHistory: TrackingSeriesHistory | null
  readonly activityLabel: string
  readonly isOpen: boolean
  readonly loading?: boolean
  readonly errorMessage?: string | null
  readonly onClose: () => void
}

function ConflictWarning(): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="rounded-md border border-tone-danger-border bg-tone-danger-bg p-3">
      <div class="flex items-start">
        <svg
          class="mr-2 mt-0.5 h-5 w-5 shrink-0 text-tone-danger-fg"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div>
          <p class="text-sm-ui font-medium text-tone-danger-fg">
            {t(keys.shipmentView.timeline.predictionHistory.conflictWarning)}
          </p>
          <p class="mt-1 text-sm-ui text-tone-danger-fg">
            {t(keys.shipmentView.timeline.predictionHistory.conflictHelper)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function PredictionHistoryModal(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const title = createMemo(
    () => `${t(keys.shipmentView.timeline.predictionHistory.title)} — ${props.activityLabel}`,
  )

  return (
    <Dialog open={props.isOpen} onClose={props.onClose} title={title()} maxWidth="2xl">
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

        <Show when={props.loading !== true && props.errorMessage == null && props.seriesHistory}>
          {(seriesHistory) => (
            <>
              <Show when={seriesHistory().hasActualConflict}>
                <ConflictWarning />
              </Show>

              <PredictionHistoryTable classified={seriesHistory().classified} locale={locale()} />
            </>
          )}
        </Show>

        <Show
          when={
            props.loading !== true && props.errorMessage == null && props.seriesHistory === null
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
