import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { createMemo, For } from 'solid-js'
import type { ContainerObservationVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import type { TemporalValueDto } from '~/shared/time/dto'
import { Dialog } from '~/shared/ui/Dialog'

type Props = {
  readonly observation: ContainerObservationVM
  readonly isOpen: boolean
  readonly onClose: () => void
}

type InspectorRow = {
  readonly label: string
  readonly value: string
  readonly tone?: 'default' | 'technical'
}

export function ObservationInspector(props: Props): JSX.Element {
  const { t, keys } = useTranslation()

  const booleanRawValue = (value: boolean | null): string => {
    if (value === true) return t(keys.shipmentView.timeline.observationInspector.values.true)
    if (value === false) return t(keys.shipmentView.timeline.observationInspector.values.false)
    return t(keys.shipmentView.timeline.observationInspector.values.null)
  }

  const conditionValue = (value: boolean | null): string => {
    if (value === true) return t(keys.shipmentView.timeline.observationInspector.values.empty)
    if (value === false) return t(keys.shipmentView.timeline.observationInspector.values.notEmpty)
    return t(keys.shipmentView.timeline.observationInspector.values.unknown)
  }

  const asValue = (value: string | null): string =>
    value ?? t(keys.shipmentView.timeline.observationInspector.values.unavailable)
  const asTemporalValue = (value: TemporalValueDto | null): string =>
    value?.value ?? t(keys.shipmentView.timeline.observationInspector.values.unavailable)

  const rows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.type),
      value: props.observation.type,
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.eventTime),
      value: asTemporalValue(props.observation.eventTime),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.eventTimeType),
      value: props.observation.eventTimeType,
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.locationCode),
      value: asValue(props.observation.locationCode),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.locationDisplay),
      value: asValue(props.observation.locationDisplay),
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.vesselName),
      value: asValue(props.observation.vesselName),
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.voyage),
      value: asValue(props.observation.voyage),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.condition),
      value: conditionValue(props.observation.isEmpty),
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.isEmpty),
      value: booleanRawValue(props.observation.isEmpty),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.provider),
      value: props.observation.provider,
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.carrierLabel),
      value: asValue(props.observation.carrierLabel),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.confidence),
      value: props.observation.confidence,
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.retroactive),
      value: props.observation.retroactive
        ? t(keys.shipmentView.timeline.observationInspector.values.true)
        : t(keys.shipmentView.timeline.observationInspector.values.false),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.fingerprint),
      value: props.observation.fingerprint,
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.createdAt),
      value: props.observation.createdAt,
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.createdFromSnapshotId),
      value: asValue(props.observation.createdFromSnapshotId),
      tone: 'technical',
    },
  ])

  const title = createMemo(() =>
    t(keys.shipmentView.timeline.observationInspector.title, { type: props.observation.type }),
  )

  return (
    <Dialog open={props.isOpen} onClose={props.onClose} title={title()} maxWidth="3xl">
      <div class="space-y-3">
        <dl class="overflow-hidden rounded-md border border-border bg-surface-muted/40">
          <For each={rows()}>
            {(row) => (
              <div class="grid items-start gap-x-3 gap-y-1 border-b border-border/70 px-3 py-2 last:border-b-0 md:grid-cols-[250px_minmax(0,1fr)]">
                <dt class="min-w-0 whitespace-nowrap text-micro font-semibold uppercase tracking-wide text-text-muted md:pr-2">
                  {row.label}
                </dt>

                <dd
                  class={clsx('min-w-0 text-sm-ui text-foreground', {
                    'font-mono text-xs-ui [overflow-wrap:anywhere]': row.tone === 'technical',
                    'break-words': row.tone !== 'technical',
                  })}
                >
                  {row.value}
                </dd>
              </div>
            )}
          </For>
        </dl>

        <div class="flex justify-end border-t border-border pt-3">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-md border border-border bg-surface px-4 py-2 text-sm-ui font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            {t(keys.shipmentView.timeline.observationInspector.close)}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
