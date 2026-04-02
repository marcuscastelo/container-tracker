import { A } from '@solidjs/router'
import type { Accessor, JSX } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import { ShipmentScreenSkeleton } from '~/modules/process/ui/screens/shipment/components/ShipmentScreenSkeleton'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'

type ShipmentScreenLayoutProps = {
  readonly shipmentData: Accessor<ShipmentDetailVM | null | undefined>
  readonly shipmentLoading: Accessor<boolean>
  readonly shipmentError: Accessor<unknown>
  readonly onOpenCreateProcess: () => void
  readonly onDashboardIntent: () => void
  readonly searchSlot?: JSX.Element
  readonly actionsSlot?: JSX.Element
  readonly banners: JSX.Element
  readonly dialogs: JSX.Element
  readonly content: JSX.Element
}

export function ShipmentScreenLayout(props: ShipmentScreenLayoutProps) {
  const { t, keys } = useTranslation()

  const shouldShowNotFound = () =>
    props.shipmentData() === null && !props.shipmentLoading() && !props.shipmentError()
  const shouldShowPendingLoading = () =>
    props.shipmentData() === undefined && !props.shipmentError()
  const shouldShowLoadError = () =>
    Boolean(props.shipmentError()) && props.shipmentData() === undefined && !props.shipmentLoading()

  const triggerDashboardIntent = () => {
    props.onDashboardIntent()
  }

  return (
    <div class="relative min-h-screen bg-background">
      {/* Wallpaper watermark — decorative only, does not affect layout */}
      <img
        src={BRANDING.wallpaper}
        alt=""
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 z-0 h-full w-full select-none object-cover opacity-[0.04]"
      />
      <div class="relative z-10">
        <AppHeader
          onCreateProcess={props.onOpenCreateProcess}
          onDashboardIntent={props.onDashboardIntent}
          searchSlot={props.searchSlot}
          actionsSlot={props.actionsSlot}
        />

        {props.banners}
        {props.dialogs}

        <main class="relative mx-auto max-w-(--dashboard-container-max-width) px-[var(--dashboard-container-px)] pb-[var(--dashboard-container-py)] pt-6">
          <A
            href="/"
            noScroll
            class="mb-3 inline-flex items-center gap-1.5 text-sm-ui text-text-muted transition-colors hover:text-foreground"
            onPointerEnter={triggerDashboardIntent}
            onFocusIn={triggerDashboardIntent}
            onPointerDown={triggerDashboardIntent}
          >
            <ChevronLeftIcon />
            {t(keys.shipmentView.backToList)}
          </A>

          <Show when={shouldShowPendingLoading()}>
            <ShipmentScreenSkeleton />
          </Show>

          <Show when={shouldShowLoadError()}>
            <div class="rounded-lg border border-border bg-surface p-12 text-center">
              <p class="text-tone-danger-fg">{t(keys.shipmentView.loadError)}</p>
              <A
                href="/"
                noScroll
                class="mt-4 inline-block text-sm-ui text-text-muted hover:text-foreground"
                onPointerEnter={triggerDashboardIntent}
                onFocusIn={triggerDashboardIntent}
                onPointerDown={triggerDashboardIntent}
              >
                {t(keys.shipmentView.backToDashboard)}
              </A>
            </div>
          </Show>

          <Show when={shouldShowNotFound()}>
            <div class="rounded-lg border border-border bg-surface p-12 text-center">
              <p class="text-tone-danger-fg">{t(keys.shipmentView.notFound)}</p>
              <A
                href="/"
                noScroll
                class="mt-4 inline-block text-sm-ui text-text-muted hover:text-foreground"
                onPointerEnter={triggerDashboardIntent}
                onFocusIn={triggerDashboardIntent}
                onPointerDown={triggerDashboardIntent}
              >
                {t(keys.shipmentView.backToDashboard)}
              </A>
            </div>
          </Show>

          <Show when={props.shipmentData() !== null && props.shipmentData() !== undefined}>
            {props.content}
          </Show>
        </main>
      </div>
    </div>
  )
}
