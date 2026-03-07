import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import { PredictionHistoryTable } from '~/modules/process/ui/components/PredictionHistoryTable'
import type { TrackingObservationDTO } from '~/modules/tracking/application/projection/tracking.observation.dto'
import { classifyTrackingSeries } from '~/modules/tracking/application/projection/tracking.series.classification'
import { useTranslation } from '~/shared/localization/i18n'
import { Dialog } from '~/shared/ui/Dialog'

type Props = {
  readonly series: readonly TrackingObservationDTO[]
  readonly activityLabel: string
  readonly isOpen: boolean
  readonly onClose: () => void
}

function ConflictWarning(): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="rounded-md border border-red-200 bg-red-50 p-3">
      <div class="flex items-start">
        <svg
          class="mr-2 mt-0.5 h-5 w-5 shrink-0 text-red-600"
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
          <p class="text-md-ui font-medium text-red-800">
            {t(keys.shipmentView.timeline.predictionHistory.conflictWarning)}
          </p>
          <p class="mt-1 text-md-ui text-red-700">
            {t(keys.shipmentView.timeline.predictionHistory.conflictHelper)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function PredictionHistoryModal(props: Props): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const classification = createMemo(() => classifyTrackingSeries(props.series))
  const title = createMemo(
    () => `${t(keys.shipmentView.timeline.predictionHistory.title)} — ${props.activityLabel}`,
  )

  return (
    <Dialog open={props.isOpen} onClose={props.onClose} title={title()} maxWidth="2xl">
      <div class="space-y-4">
        <Show when={classification().hasActualConflict}>
          <ConflictWarning />
        </Show>

        <PredictionHistoryTable classified={classification().classified} locale={locale()} />

        <div class="flex justify-end border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-md border border-slate-300 bg-white px-4 py-2 text-md-ui font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t(keys.shipmentView.timeline.predictionHistory.close)}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
