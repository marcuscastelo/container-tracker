import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import { formatTrackingTimeTravelSyncLabel } from '~/modules/process/ui/screens/shipment/lib/tracking-time-travel.formatting.utils'
import type { TrackingTimeTravelSyncVM } from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import { useTranslation } from '~/shared/localization/i18n'

type TrackingTimeTravelBarProps = {
  readonly isLoading: boolean
  readonly errorMessage: string | null
  readonly syncs: readonly TrackingTimeTravelSyncVM[]
  readonly selectedSync: TrackingTimeTravelSyncVM | null
  readonly isDebugOpen: boolean
  readonly onClose: () => void
  readonly onToggleDebug: () => void
  readonly onSelectSnapshot: (snapshotId: string) => void
  readonly onPrevious: () => void
  readonly onNext: () => void
}

export function TrackingTimeTravelBar(props: TrackingTimeTravelBarProps): JSX.Element {
  const { t, keys, locale } = useTranslation()
  const selectId = 'tracking-time-travel-sync-selector'
  const selectedIndex = () =>
    props.selectedSync
      ? props.syncs.findIndex((sync) => sync.snapshotId === props.selectedSync?.snapshotId)
      : -1
  const hasPrevious = () => selectedIndex() > 0
  const hasNext = () => selectedIndex() >= 0 && selectedIndex() < props.syncs.length - 1

  return (
    <section class="rounded-xl border border-border/70 bg-surface px-3 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex rounded-full border border-tone-info-border bg-tone-info-bg px-2 py-0.5 text-micro font-semibold uppercase tracking-wider text-tone-info-fg">
          {t(keys.shipmentView.timeTravel.badge)}
        </span>
        <Show when={props.selectedSync}>
          {(sync) => (
            <div class="text-sm-ui font-semibold text-foreground">
              {t(keys.shipmentView.timeTravel.syncPosition, {
                current: sync().position,
                total: props.syncs.length,
              })}
              {' \u2014 '}
              {formatTrackingTimeTravelSyncLabel(sync().fetchedAtIso, locale())}
            </div>
          )}
        </Show>
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
            disabled={!hasPrevious()}
            onClick={() => props.onPrevious()}
          >
            {t(keys.shipmentView.timeTravel.previous)}
          </button>
          <button
            type="button"
            class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
            disabled={!hasNext()}
            onClick={() => props.onNext()}
          >
            {t(keys.shipmentView.timeTravel.next)}
          </button>
          <button
            type="button"
            class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground disabled:opacity-50"
            disabled={!props.selectedSync?.debugAvailable}
            onClick={() => props.onToggleDebug()}
          >
            {props.isDebugOpen
              ? t(keys.shipmentView.timeTravel.closeDebug)
              : t(keys.shipmentView.timeTravel.openDebug)}
          </button>
          <button
            type="button"
            class="rounded-md border border-border bg-surface px-3 py-2 text-xs-ui font-medium text-foreground"
            onClick={() => props.onClose()}
          >
            {t(keys.shipmentView.timeTravel.close)}
          </button>
        </div>
      </div>

      <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label
          for={selectId}
          class="text-micro font-medium uppercase tracking-wider text-text-muted"
        >
          {t(keys.shipmentView.timeTravel.syncSelector)}
        </label>
        <Show
          when={props.syncs.length > 0}
          fallback={
            <p class="text-xs-ui text-text-muted">{t(keys.shipmentView.timeTravel.empty)}</p>
          }
        >
          <select
            id={selectId}
            class="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm-ui text-foreground"
            value={props.selectedSync?.snapshotId ?? ''}
            disabled={props.syncs.length <= 1}
            onChange={(event) => props.onSelectSnapshot(event.currentTarget.value)}
          >
            <For each={props.syncs}>
              {(sync) => (
                <option value={sync.snapshotId}>
                  {t(keys.shipmentView.timeTravel.syncPosition, {
                    current: sync.position,
                    total: props.syncs.length,
                  })}{' '}
                  {'\u2014'} {formatTrackingTimeTravelSyncLabel(sync.fetchedAtIso, locale())}
                </option>
              )}
            </For>
          </select>
        </Show>
      </div>

      <Show when={props.isLoading}>
        <p class="mt-2 text-xs-ui text-text-muted">{t(keys.shipmentView.timeTravel.loading)}</p>
      </Show>
      <Show when={props.errorMessage}>
        {(errorMessage) => (
          <p class="mt-2 rounded-md border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-xs-ui text-tone-danger-fg">
            {t(keys.shipmentView.timeTravel.error)}: {errorMessage()}
          </p>
        )}
      </Show>
    </section>
  )
}
