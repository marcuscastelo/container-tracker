import clsx from 'clsx'
import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { ContainerObservationVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import type { TemporalValueDto } from '~/shared/time/dto'
import { Dialog } from '~/shared/ui/Dialog'

type Props = {
  readonly observation: ContainerObservationVM | null
  readonly isOpen: boolean
  readonly loading?: boolean
  readonly errorMessage?: string | null
  readonly onClose: () => void
}

type InspectorRow = {
  readonly label: string
  readonly value: string
  readonly tone?: 'default' | 'technical'
}

function ObservationInspectorMessage(props: {
  readonly tone: 'default' | 'danger'
  readonly message: string
}): JSX.Element {
  return (
    <div
      class={clsx('rounded-md border px-4 py-6 text-center text-sm-ui', {
        'border-border bg-surface text-text-muted': props.tone === 'default',
        'border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg': props.tone === 'danger',
      })}
    >
      {props.message}
    </div>
  )
}

function ObservationInspectorRows(props: { readonly rows: readonly InspectorRow[] }): JSX.Element {
  return (
    <dl class="overflow-hidden rounded-md border border-border bg-surface-muted/40">
      <For each={props.rows}>{(row) => <ObservationInspectorRow row={row} />}</For>
    </dl>
  )
}

function ObservationInspectorRow(props: { readonly row: InspectorRow }): JSX.Element {
  return (
    <div class="grid items-start gap-x-3 gap-y-1 border-b border-border/70 px-3 py-2 last:border-b-0 md:grid-cols-[250px_minmax(0,1fr)]">
      <dt class="min-w-0 whitespace-nowrap text-micro font-semibold uppercase tracking-wide text-text-muted md:pr-2">
        {props.row.label}
      </dt>

      <dd
        class={clsx('min-w-0 text-sm-ui text-foreground', {
          'font-mono text-xs-ui [overflow-wrap:anywhere]': props.row.tone === 'technical',
          'break-words': props.row.tone !== 'technical',
        })}
      >
        {props.row.value}
      </dd>
    </div>
  )
}

export function ObservationInspector(props: Props): JSX.Element {
  const { t, keys } = useTranslation()
  const observation = () => props.observation

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

  const identityRows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.type),
      value:
        observation()?.type ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.eventTime),
      value: asTemporalValue(observation()?.eventTime ?? null),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.eventTimeType),
      value:
        observation()?.eventTimeType ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.locationCode),
      value: asValue(observation()?.locationCode ?? null),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.locationDisplay),
      value: asValue(observation()?.locationDisplay ?? null),
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.vesselName),
      value: asValue(observation()?.vesselName ?? null),
    },
  ])

  const conditionRows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.voyage),
      value: asValue(observation()?.voyage ?? null),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.condition),
      value: conditionValue(observation()?.isEmpty ?? null),
    },
  ])

  const technicalRows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.isEmpty),
      value: booleanRawValue(observation()?.isEmpty ?? null),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.provider),
      value:
        observation()?.provider ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.carrierLabel),
      value: asValue(observation()?.carrierLabel ?? null),
      tone: 'technical',
    },
  ])

  const metadataRows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.confidence),
      value:
        observation()?.confidence ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.retroactive),
      value: observation()?.retroactive
        ? t(keys.shipmentView.timeline.observationInspector.values.true)
        : t(keys.shipmentView.timeline.observationInspector.values.false),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.fingerprint),
      value:
        observation()?.fingerprint ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.createdAt),
      value:
        observation()?.createdAt ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.createdFromSnapshotId),
      value: asValue(observation()?.createdFromSnapshotId ?? null),
      tone: 'technical',
    },
  ])

  const rows = createMemo<readonly InspectorRow[]>(() => [
    ...identityRows(),
    ...conditionRows(),
    ...technicalRows(),
    ...metadataRows(),
  ])

  const title = createMemo(() =>
    t(keys.shipmentView.timeline.observationInspector.title, {
      type:
        observation()?.type ??
        t(keys.shipmentView.timeline.observationInspector.values.unavailable),
    }),
  )

  return (
    <Dialog open={props.isOpen} onClose={props.onClose} title={title()} maxWidth="3xl">
      <div class="space-y-3">
        <Show when={props.loading === true}>
          <ObservationInspectorMessage tone="default" message={t(keys.shipmentView.loading)} />
        </Show>

        <Show when={props.loading !== true && props.errorMessage}>
          {(errorMessage) => <ObservationInspectorMessage tone="danger" message={errorMessage()} />}
        </Show>

        <Show when={props.loading !== true && props.errorMessage == null && props.observation}>
          <ObservationInspectorRows rows={rows()} />
        </Show>

        <Show
          when={props.loading !== true && props.errorMessage == null && props.observation === null}
        >
          <ObservationInspectorMessage
            tone="default"
            message={t(keys.shipmentView.timeline.observationInspector.values.unavailable)}
          />
        </Show>

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
