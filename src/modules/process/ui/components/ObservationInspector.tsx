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

type ObservationIdentitySource = {
  readonly type: string | null
  readonly eventTime: TemporalValueDto | null
  readonly eventTimeType: string | null
  readonly rawEventTime: string | null
  readonly eventTimeSource: string | null
  readonly locationCode: string | null
  readonly locationDisplay: string | null
  readonly vesselName: string | null
}

const EMPTY_OBSERVATION_IDENTITY_SOURCE: ObservationIdentitySource = {
  type: null,
  eventTime: null,
  eventTimeType: null,
  rawEventTime: null,
  eventTimeSource: null,
  locationCode: null,
  locationDisplay: null,
  vesselName: null,
}

function formatBooleanRawValue(
  value: boolean | null,
  labels: {
    readonly trueLabel: string
    readonly falseLabel: string
    readonly nullLabel: string
  },
): string {
  if (value === true) return labels.trueLabel
  if (value === false) return labels.falseLabel
  return labels.nullLabel
}

function formatConditionValue(
  value: boolean | null,
  labels: {
    readonly emptyLabel: string
    readonly notEmptyLabel: string
    readonly unknownLabel: string
  },
): string {
  if (value === true) return labels.emptyLabel
  if (value === false) return labels.notEmptyLabel
  return labels.unknownLabel
}

function formatInspectorValue(value: string | null, unavailableLabel: string): string {
  return value ?? unavailableLabel
}

function formatInspectorTemporalValue(
  value: TemporalValueDto | null,
  unavailableLabel: string,
): string {
  if (value === null) {
    return unavailableLabel
  }

  if (value.kind === 'local-datetime') {
    return `${value.value}[${value.timezone}]`
  }

  if (value.kind === 'date') {
    return value.timezone === null || value.timezone === undefined
      ? value.value
      : `${value.value}[${value.timezone}]`
  }

  return value.value
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
  const unavailableLabel = () =>
    t(keys.shipmentView.timeline.observationInspector.values.unavailable)

  const identityValues = createMemo(() => {
    const currentObservation = observation()
    const source: ObservationIdentitySource =
      currentObservation === null
        ? EMPTY_OBSERVATION_IDENTITY_SOURCE
        : {
            type: currentObservation.type,
            eventTime: currentObservation.eventTime,
            eventTimeType: currentObservation.eventTimeType,
            rawEventTime: currentObservation.rawEventTime,
            eventTimeSource: currentObservation.eventTimeSource,
            locationCode: currentObservation.locationCode,
            locationDisplay: currentObservation.locationDisplay,
            vesselName: currentObservation.vesselName,
          }

    return {
      type: formatInspectorValue(source.type, unavailableLabel()),
      eventTime: formatInspectorTemporalValue(source.eventTime, unavailableLabel()),
      eventTimeType: formatInspectorValue(source.eventTimeType, unavailableLabel()),
      rawEventTime: formatInspectorValue(source.rawEventTime, unavailableLabel()),
      eventTimeSource: formatInspectorValue(source.eventTimeSource, unavailableLabel()),
      locationCode: formatInspectorValue(source.locationCode, unavailableLabel()),
      locationDisplay: formatInspectorValue(source.locationDisplay, unavailableLabel()),
      vesselName: formatInspectorValue(source.vesselName, unavailableLabel()),
    }
  })

  const identityRows = createMemo<readonly InspectorRow[]>(() => {
    const values = identityValues()

    return [
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.type),
        value: values.type,
        tone: 'technical',
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.eventTime),
        value: values.eventTime,
        tone: 'technical',
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.eventTimeType),
        value: values.eventTimeType,
        tone: 'technical',
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.rawEventTime),
        value: values.rawEventTime,
        tone: 'technical',
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.eventTimeSource),
        value: values.eventTimeSource,
        tone: 'technical',
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.locationCode),
        value: values.locationCode,
        tone: 'technical',
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.locationDisplay),
        value: values.locationDisplay,
      },
      {
        label: t(keys.shipmentView.timeline.observationInspector.fields.vesselName),
        value: values.vesselName,
      },
    ]
  })

  const conditionRows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.voyage),
      value: formatInspectorValue(observation()?.voyage ?? null, unavailableLabel()),
      tone: 'technical',
    },
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.condition),
      value: formatConditionValue(observation()?.isEmpty ?? null, {
        emptyLabel: t(keys.shipmentView.timeline.observationInspector.values.empty),
        notEmptyLabel: t(keys.shipmentView.timeline.observationInspector.values.notEmpty),
        unknownLabel: t(keys.shipmentView.timeline.observationInspector.values.unknown),
      }),
    },
  ])

  const technicalRows = createMemo<readonly InspectorRow[]>(() => [
    {
      label: t(keys.shipmentView.timeline.observationInspector.fields.isEmpty),
      value: formatBooleanRawValue(observation()?.isEmpty ?? null, {
        trueLabel: t(keys.shipmentView.timeline.observationInspector.values.true),
        falseLabel: t(keys.shipmentView.timeline.observationInspector.values.false),
        nullLabel: t(keys.shipmentView.timeline.observationInspector.values.null),
      }),
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
      value: formatInspectorValue(observation()?.carrierLabel ?? null, unavailableLabel()),
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
      value: formatInspectorValue(observation()?.createdFromSnapshotId ?? null, unavailableLabel()),
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
