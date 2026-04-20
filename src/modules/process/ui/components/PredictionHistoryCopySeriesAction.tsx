import { Check, Copy } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import toast from 'solid-toast'
import { serializePredictionHistorySeriesToText } from '~/modules/process/ui/components/prediction-history-copy.presenter'
import type { PredictionHistorySource } from '~/modules/process/ui/viewmodels/prediction-history.vm'
import { useTranslation } from '~/shared/localization/i18n'
import { useTransientFlag } from '~/shared/ui/motion/useTransientFlag'
import { copyToClipboard } from '~/shared/utils/clipboard'

type Props = {
  readonly source: PredictionHistorySource
  readonly activityLabel: string
}

export function PredictionHistoryCopySeriesAction(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const copyFeedback = useTransientFlag()
  const isCopied = createMemo(() => copyFeedback.isActive())
  const buttonLabel = createMemo(() =>
    isCopied()
      ? t(keys.shipmentView.timeline.predictionHistory.copySeriesCopied)
      : t(keys.shipmentView.timeline.predictionHistory.copySeries),
  )

  const handleCopySeries = async (): Promise<void> => {
    try {
      const copied = await copyToClipboard(
        serializePredictionHistorySeriesToText({
          source: props.source,
          activityLabel: props.activityLabel,
        }),
      )

      if (copied) {
        copyFeedback.activate()
      } else {
        toast.error(t(keys.shipmentView.timeline.predictionHistory.copySeriesError))
      }
    } catch (error) {
      console.error('Failed to copy prediction history series', error)
      toast.error(t(keys.shipmentView.timeline.predictionHistory.copySeriesError))
    }
  }

  return (
    <div class="flex justify-end">
      <button
        type="button"
        class="motion-focus-surface motion-interactive inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs-ui font-medium text-foreground hover:bg-surface-muted"
        onClick={() => void handleCopySeries()}
      >
        <Show
          when={isCopied()}
          fallback={<Copy class="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />}
        >
          <Check
            class="motion-copy-feedback h-3.5 w-3.5 shrink-0 text-tone-success-fg"
            aria-hidden="true"
          />
        </Show>
        <span class="motion-copy-feedback" data-state={isCopied() ? 'copied' : 'idle'}>
          {buttonLabel()}
        </span>
      </button>
    </div>
  )
}
