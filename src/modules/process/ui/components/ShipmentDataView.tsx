import { ExternalLink, Info } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createMemo, ErrorBoundary, Show } from 'solid-js'
import { AlertsPanel } from '~/modules/process/ui/components/AlertsPanel'
import { ContainersPanel } from '~/modules/process/ui/components/ContainersPanel'
import { ShipmentCurrentStatus } from '~/modules/process/ui/components/ShipmentCurrentStatus'
import { ShipmentHeader } from '~/modules/process/ui/components/ShipmentHeader'
import { ShipmentInfoCard } from '~/modules/process/ui/components/ShipmentInfoCard'
import { TimelinePanel } from '~/modules/process/ui/components/TimelinePanel'
import { TrackingTimeTravelAlertsPanel } from '~/modules/process/ui/screens/shipment/components/TrackingTimeTravelAlertsPanel'
import { TrackingTimeTravelBar } from '~/modules/process/ui/screens/shipment/components/TrackingTimeTravelBar'
import { TrackingTimeTravelDebugPanel } from '~/modules/process/ui/screens/shipment/components/TrackingTimeTravelDebugPanel'
import { TrackingTimeTravelDiffSummary } from '~/modules/process/ui/screens/shipment/components/TrackingTimeTravelDiffSummary'
import { TrackingTimeTravelStatusPanel } from '~/modules/process/ui/screens/shipment/components/TrackingTimeTravelStatusPanel'
import { TrackingTimeTravelTimelinePanel } from '~/modules/process/ui/screens/shipment/components/TrackingTimeTravelTimelinePanel'
import type { TrackingTimeTravelControllerResult } from '~/modules/process/ui/screens/shipment/hooks/useTrackingTimeTravelController'
import { resolveShipmentTrackingContainmentDisplay } from '~/modules/process/ui/screens/shipment/lib/shipmentTrackingContainmentDisplay'
import { resolveShipmentTrackingValidationDisplay } from '~/modules/process/ui/screens/shipment/lib/shipmentTrackingReviewDisplay'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { AlertIncidentsVM } from '~/modules/process/ui/viewmodels/alert-incident.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { useTranslation } from '~/shared/localization/i18n'
import type { Instant } from '~/shared/time/instant'
import { MotionCollapse } from '~/shared/ui/motion/MotionCollapse'
import { useSwapTransition } from '~/shared/ui/motion/useSwapTransition'

type ShipmentDataViewProps = {
  readonly data: ShipmentDetailVM
  readonly activeAlerts: readonly AlertDisplayVM[]
  readonly alertIncidents: AlertIncidentsVM
  readonly busyAlertIds: ReadonlySet<string>
  readonly recentlyChangedAlertIds: ReadonlySet<string>
  readonly onAcknowledgeAlert: (alertIds: readonly string[]) => void
  readonly onUnacknowledgeAlert: (alertIds: readonly string[]) => void
  readonly onOpenEdit: (focus?: 'reference' | 'carrier' | null | undefined) => void
  readonly isRefreshing: boolean
  readonly refreshRetry: { readonly current: number; readonly total: number } | null
  readonly refreshHint: string | null
  readonly syncNow: Instant
  readonly onTriggerRefresh: () => void
  readonly selectedContainerId: string
  readonly onSelectContainer: (containerId: string) => void
  readonly selectedContainer: ShipmentDetailVM['containers'][number] | null
  readonly trackingTimeTravel: TrackingTimeTravelControllerResult
}

type ShipmentCurrentAlertsSectionProps = Pick<
  ShipmentDataViewProps,
  | 'alertIncidents'
  | 'busyAlertIds'
  | 'recentlyChangedAlertIds'
  | 'data'
  | 'onAcknowledgeAlert'
  | 'onUnacknowledgeAlert'
  | 'onSelectContainer'
>

function ShipmentCurrentAlertsSection(props: ShipmentCurrentAlertsSectionProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="mb-3">
      <ErrorBoundary
        fallback={(err) => {
          console.error('Alerts panel render failure:', err)
          return (
            <div class="rounded-lg border border-tone-warning-border bg-tone-warning-bg px-3 py-2 text-xs-ui text-tone-warning-fg">
              {t(keys.app.unexpectedRenderError)}
            </div>
          )
        }}
      >
        <AlertsPanel
          processId={props.data.id}
          alertIncidents={props.alertIncidents}
          busyAlertIds={props.busyAlertIds}
          recentlyChangedAlertIds={props.recentlyChangedAlertIds}
          onAcknowledge={props.onAcknowledgeAlert}
          onUnacknowledge={props.onUnacknowledgeAlert}
          onSelectContainer={props.onSelectContainer}
        />
      </ErrorBoundary>
    </div>
  )
}

type ShipmentTimelineRegionProps = Pick<
  ShipmentDataViewProps,
  'data' | 'selectedContainer' | 'trackingTimeTravel'
>

type TrackingContainmentNoticeProps = {
  readonly containment: NonNullable<ShipmentDetailVM['containers'][number]['trackingContainment']>
}

function TrackingContainmentNotice(props: TrackingContainmentNoticeProps): JSX.Element {
  const { t, keys } = useTranslation()

  return (
    <div class="rounded-xl border border-tone-info-border bg-tone-info-bg/50 px-4 py-3 text-sm-ui text-tone-info-fg shadow-[0_1px_2px_rgb(0_0_0_/6%)]">
      <div class="flex items-start gap-3">
        <Info aria-hidden="true" class="mt-0.5 h-4 w-4 shrink-0" />
        <div class="min-w-0 space-y-2">
          <div>
            <p class="font-semibold">{t(keys.shipmentView.containment.noticeTitle)}</p>
            <p class="mt-1 text-xs-ui text-tone-info-fg">
              {t(keys.shipmentView.containment.noticeDescription)}
            </p>
          </div>
          <Show when={props.containment.externalTrackingUrl}>
            {(externalTrackingUrl) => (
              <a
                href={externalTrackingUrl()}
                target="_blank"
                rel="noopener noreferrer"
                class="motion-focus-surface motion-interactive inline-flex items-center gap-1 rounded-md border border-tone-info-border bg-surface px-2 py-1 text-xs-ui font-medium text-tone-info-strong hover:bg-tone-info-bg/70"
              >
                <ExternalLink class="h-3.5 w-3.5" />
                <span>{t(keys.shipmentView.containment.openCarrierTracking)}</span>
              </a>
            )}
          </Show>
        </div>
      </div>
    </div>
  )
}

function ShipmentTimelineRegion(props: ShipmentTimelineRegionProps): JSX.Element {
  const { t, keys } = useTranslation()
  const containmentNotice = createMemo(() =>
    resolveShipmentTrackingContainmentDisplay({
      shipment: props.data,
      selectedContainerId: props.selectedContainer?.id ?? '',
      selectedSync: props.trackingTimeTravel.selectedSync(),
    }),
  )

  return (
    <Show when={props.selectedContainer}>
      {(container) => (
        <section id="shipment-timeline" class="scroll-mt-30 space-y-3">
          <Show when={containmentNotice()}>
            {(containment) => <TrackingContainmentNotice containment={containment()} />}
          </Show>
          <ErrorBoundary
            fallback={(err) => {
              console.error('Timeline panel render failure:', err)
              return (
                <div class="rounded-lg border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-xs-ui text-tone-danger-fg">
                  {t(keys.app.unexpectedRenderError)}
                </div>
              )
            }}
          >
            <Show
              when={props.trackingTimeTravel.isActive()}
              fallback={
                <TimelinePanel
                  selectedContainer={props.selectedContainer}
                  {...(props.data.carrier === undefined ? {} : { carrier: props.data.carrier })}
                />
              }
            >
              <TrackingTimeTravelTimelinePanel
                containerNumber={container().number}
                referenceNowIso={props.trackingTimeTravel.value()?.referenceNowIso ?? null}
                selectedSync={props.trackingTimeTravel.selectedSync()}
                {...(props.data.carrier === undefined ? {} : { carrier: props.data.carrier })}
              />
            </Show>
          </ErrorBoundary>

          <MotionCollapse
            open={props.trackingTimeTravel.isActive() && props.trackingTimeTravel.isDebugOpen()}
          >
            <TrackingTimeTravelDebugPanel
              containerNumber={container().number}
              loading={props.trackingTimeTravel.isDebugLoading()}
              errorMessage={props.trackingTimeTravel.debugErrorMessage()}
              debug={props.trackingTimeTravel.debugValue()}
              debugPayload={props.trackingTimeTravel.debugPayload()}
            />
          </MotionCollapse>
        </section>
      )}
    </Show>
  )
}

type ShipmentSidebarRegionProps = Pick<
  ShipmentDataViewProps,
  'data' | 'selectedContainer' | 'syncNow' | 'trackingTimeTravel'
>

function ShipmentSidebarRegion(props: ShipmentSidebarRegionProps): JSX.Element {
  return (
    <div class="space-y-4">
      <ShipmentInfoCard data={props.data} />
      <Show
        when={props.trackingTimeTravel.isActive()}
        fallback={
          <section id="shipment-current-status" class="scroll-mt-30">
            <ShipmentCurrentStatus
              selectedContainer={props.selectedContainer}
              syncNow={props.syncNow}
              onOpenTimeTravel={props.trackingTimeTravel.open}
            />
          </section>
        }
      >
        <section id="shipment-historical-status" class="scroll-mt-30">
          <TrackingTimeTravelStatusPanel
            containerNumber={props.selectedContainer?.number ?? null}
            selectedSync={props.trackingTimeTravel.selectedSync()}
          />
        </section>
        <section id="shipment-historical-alerts" class="scroll-mt-30">
          <TrackingTimeTravelAlertsPanel
            alerts={props.trackingTimeTravel.selectedSync()?.alerts ?? []}
            referenceNowIso={props.trackingTimeTravel.value()?.referenceNowIso ?? null}
          />
        </section>
        <section id="shipment-historical-diff" class="scroll-mt-30">
          <TrackingTimeTravelDiffSummary
            diff={props.trackingTimeTravel.selectedSync()?.diff ?? null}
          />
        </section>
      </Show>
    </div>
  )
}

export function ShipmentDataView(props: ShipmentDataViewProps): JSX.Element {
  const isHistoricalMode = () => props.trackingTimeTravel.isActive()
  const selectionSwap = useSwapTransition({
    key: () => props.selectedContainer?.id ?? null,
  })
  const displayedContainer = createMemo(() => {
    if (isHistoricalMode()) {
      return props.selectedContainer
    }

    const renderedKey = selectionSwap.renderedKey()
    if (renderedKey === null) {
      return props.selectedContainer
    }

    return (
      props.data.containers.find((container) => container.id === renderedKey) ??
      props.selectedContainer
    )
  })
  const shouldShowCurrentAlertsSection = () =>
    !isHistoricalMode() && props.alertIncidents.active.length > 0
  const trackingValidationDisplay = createMemo(() =>
    resolveShipmentTrackingValidationDisplay({
      shipment: props.data,
      selectedContainerId: displayedContainer()?.id ?? props.selectedContainerId,
      selectedSync: props.trackingTimeTravel.selectedSync(),
    }),
  )

  return (
    <div class="space-y-4">
      <ShipmentHeader
        data={props.data}
        trackingValidation={trackingValidationDisplay().shipmentTrackingValidation}
        trackingValidationMode={trackingValidationDisplay().mode}
        historicalTrackingValidationContainerNumber={
          trackingValidationDisplay().mode === 'historical'
            ? (props.selectedContainer?.number ?? null)
            : null
        }
        isRefreshing={props.isRefreshing}
        refreshRetry={props.refreshRetry}
        refreshHint={props.refreshHint}
        onTriggerRefresh={props.onTriggerRefresh}
        onOpenEdit={props.onOpenEdit}
      />

      <Show when={shouldShowCurrentAlertsSection()}>
        <ShipmentCurrentAlertsSection
          data={props.data}
          alertIncidents={props.alertIncidents}
          busyAlertIds={props.busyAlertIds}
          recentlyChangedAlertIds={props.recentlyChangedAlertIds}
          onAcknowledgeAlert={props.onAcknowledgeAlert}
          onUnacknowledgeAlert={props.onUnacknowledgeAlert}
          onSelectContainer={props.onSelectContainer}
        />
      </Show>

      <MotionCollapse open={isHistoricalMode()} class="sticky top-4 z-30">
        <div>
          <TrackingTimeTravelBar
            isLoading={props.trackingTimeTravel.isLoading()}
            errorMessage={props.trackingTimeTravel.errorMessage()}
            syncs={props.trackingTimeTravel.value()?.syncs ?? []}
            selectedSync={props.trackingTimeTravel.selectedSync()}
            isDebugOpen={props.trackingTimeTravel.isDebugOpen()}
            onClose={props.trackingTimeTravel.close}
            onToggleDebug={props.trackingTimeTravel.toggleDebug}
            onSelectSnapshot={props.trackingTimeTravel.selectSnapshot}
            onPrevious={props.trackingTimeTravel.selectPrevious}
            onNext={props.trackingTimeTravel.selectNext}
          />
        </div>
      </MotionCollapse>

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="motion-swap-region space-y-4" data-phase={selectionSwap.phase()}>
          <section id="shipment-containers" class="scroll-mt-30">
            <ContainersPanel
              containers={trackingValidationDisplay().containers}
              selectedId={displayedContainer()?.id ?? props.selectedContainerId}
              onSelect={props.onSelectContainer}
              trackingValidationMode={trackingValidationDisplay().mode}
            />
          </section>

          <ShipmentTimelineRegion
            data={props.data}
            selectedContainer={displayedContainer()}
            trackingTimeTravel={props.trackingTimeTravel}
          />
        </div>

        <div class="motion-swap-region" data-phase={selectionSwap.phase()}>
          <ShipmentSidebarRegion
            data={props.data}
            selectedContainer={displayedContainer()}
            syncNow={props.syncNow}
            trackingTimeTravel={props.trackingTimeTravel}
          />
        </div>
      </div>
    </div>
  )
}
