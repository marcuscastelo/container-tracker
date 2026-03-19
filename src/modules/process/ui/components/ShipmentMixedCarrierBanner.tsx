import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { useTranslation } from '~/shared/localization/i18n'

type NormalizeAutoCarrierResult = {
  readonly normalized: boolean
  readonly reason: string
  readonly targetCarrierCode: string | null
}

type ShipmentMixedCarrierBannerProps = {
  readonly effectiveCarrierCodes: readonly string[]
  readonly onNormalizeAutoContainers: () => Promise<NormalizeAutoCarrierResult>
  readonly onReviewContainers: () => void
}

function toCarrierListLabel(carriers: readonly string[]): string {
  if (carriers.length === 0) return 'UNKNOWN'
  return carriers.map((carrier) => carrier.toUpperCase()).join(', ')
}

export function ShipmentMixedCarrierBanner(props: ShipmentMixedCarrierBannerProps): JSX.Element {
  const { t, keys } = useTranslation()
  const [dismissed, setDismissed] = createSignal(false)
  const [isNormalizing, setIsNormalizing] = createSignal(false)
  const [feedback, setFeedback] = createSignal<string | null>(null)
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null)

  const carrierListLabel = () => toCarrierListLabel(props.effectiveCarrierCodes)

  const handleNormalize = async () => {
    setFeedback(null)
    setErrorMessage(null)
    setIsNormalizing(true)
    try {
      const result = await props.onNormalizeAutoContainers()
      if (result.normalized) {
        const targetCarrier = result.targetCarrierCode?.toUpperCase() ?? carrierListLabel()
        setFeedback(
          t(keys.shipmentView.mixedBanner.normalizeSuccess, {
            carrier: targetCarrier,
          }),
        )
        return
      }

      setFeedback(t(keys.shipmentView.mixedBanner.normalizeNoop))
    } catch {
      setErrorMessage(t(keys.shipmentView.mixedBanner.normalizeFailed))
    } finally {
      setIsNormalizing(false)
    }
  }

  return (
    <Show when={!dismissed()}>
      <section class="rounded-lg border border-tone-warning-border bg-tone-warning-bg/55 p-3">
        <div class="space-y-2">
          <p class="text-sm-ui font-semibold text-tone-warning-fg">
            {t(keys.shipmentView.mixedBanner.title)}
          </p>
          <p class="text-xs-ui text-tone-warning-fg">
            {t(keys.shipmentView.mixedBanner.description, { carriers: carrierListLabel() })}
          </p>
          <div class="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              class="rounded-md border border-tone-warning-border bg-surface px-2.5 py-1.5 text-xs-ui font-semibold text-tone-warning-fg hover:bg-surface-muted"
              onClick={() => setDismissed(true)}
            >
              {t(keys.shipmentView.mixedBanner.keepMixed)}
            </button>
            <button
              type="button"
              class="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs-ui font-semibold text-foreground hover:bg-surface-muted"
              onClick={() => props.onReviewContainers()}
            >
              {t(keys.shipmentView.mixedBanner.reviewContainers)}
            </button>
            <button
              type="button"
              disabled={isNormalizing()}
              class="rounded-md bg-primary px-2.5 py-1.5 text-xs-ui font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => {
                void handleNormalize()
              }}
            >
              {isNormalizing()
                ? t(keys.shipmentView.mixedBanner.normalizing)
                : t(keys.shipmentView.mixedBanner.normalizeAutoContainers)}
            </button>
          </div>
          <Show when={feedback()}>
            {(value) => <p class="text-xs-ui font-medium text-tone-success-fg">{value()}</p>}
          </Show>
          <Show when={errorMessage()}>
            {(value) => <p class="text-xs-ui font-medium text-tone-danger-fg">{value()}</p>}
          </Show>
        </div>
      </section>
    </Show>
  )
}
