import { A } from '@solidjs/router'
import type { Accessor, JSX, Resource } from 'solid-js'
import { Show } from 'solid-js'
import { ChevronLeftIcon } from '~/modules/process/ui/components/Icons'
import type { AlertDisplayVM } from '~/modules/process/ui/viewmodels/alert.vm'
import type { ShipmentDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import { BRANDING } from '~/shared/config/branding'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'

type ShipmentScreenLayoutProps = {
  readonly shipmentData: Resource<ShipmentDetailVM | null | undefined>
  readonly shipmentLoading: Accessor<boolean>
  readonly shipmentError: Accessor<unknown>
  readonly activeAlerts: Accessor<readonly AlertDisplayVM[]>
  readonly onOpenCreateProcess: () => void
  readonly onDashboardIntent: () => void
  readonly banners: JSX.Element
  readonly dialogs: JSX.Element
  readonly content: JSX.Element
}

export function ShipmentScreenLayout(props: ShipmentScreenLayoutProps) {
  const { t, keys } = useTranslation()

  const shouldShowNotFound = () => props.shipmentData() === null && !props.shipmentLoading()
  const shouldShowLoadError = () =>
    Boolean(props.shipmentError()) && props.shipmentData() === undefined && !props.shipmentLoading()

  const triggerDashboardIntent = () => {
    props.onDashboardIntent()
  }

  return (
    <div class="relative min-h-screen bg-[var(--bg-page)]">
      {/* Wallpaper watermark — decorative only, does not affect layout */}
      <img
        src={BRANDING.wallpaper}
        alt=""
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 z-0 h-full w-full select-none object-cover opacity-[0.08]"
      />
      <div class="relative z-10">
        <AppHeader
          onCreateProcess={props.onOpenCreateProcess}
          alertCount={props.activeAlerts().length}
        />

        {props.banners}
        {props.dialogs}

        <main class="mx-auto max-w-7xl px-3 py-4 sm:px-5 lg:px-8">
          <A
            href="/"
            class="mb-3 inline-flex items-center gap-1 text-xs-ui text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
            onPointerEnter={triggerDashboardIntent}
            onFocusIn={triggerDashboardIntent}
            onPointerDown={triggerDashboardIntent}
          >
            <ChevronLeftIcon />
            {t(keys.shipmentView.backToList)}
          </A>

          <Show when={props.shipmentLoading()}>
            <div class="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-12 text-center shadow-[var(--card-shadow)]">
              <p class="text-[var(--text-tertiary)]">{t(keys.shipmentView.loading)}</p>
            </div>
          </Show>

          <Show when={shouldShowLoadError()}>
            <div class="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-12 text-center shadow-[var(--card-shadow)]">
              <p class="text-[var(--status-danger-text)]">{t(keys.shipmentView.loadError)}</p>
              <A
                href="/"
                class="mt-4 inline-block text-sm-ui text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                onPointerEnter={triggerDashboardIntent}
                onFocusIn={triggerDashboardIntent}
                onPointerDown={triggerDashboardIntent}
              >
                {t(keys.shipmentView.backToDashboard)}
              </A>
            </div>
          </Show>

          <Show when={shouldShowNotFound()}>
            <div class="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-12 text-center shadow-[var(--card-shadow)]">
              <p class="text-[var(--status-danger-text)]">{t(keys.shipmentView.notFound)}</p>
              <A
                href="/"
                class="mt-4 inline-block text-sm-ui text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                onPointerEnter={triggerDashboardIntent}
                onFocusIn={triggerDashboardIntent}
                onPointerDown={triggerDashboardIntent}
              >
                {t(keys.shipmentView.backToDashboard)}
              </A>
            </div>
          </Show>

          {props.content}
        </main>
      </div>
    </div>
  )
}
