import { useTranslation } from '~/shared/localization/i18n'

export function AlertActionBanner(props: { message: string; onDismiss: () => void }) {
  const { t, keys } = useTranslation()
  return (
    <div class="mx-auto mt-2 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="rounded-md border border-tone-warning-border bg-tone-warning-bg p-3 text-md-ui text-tone-warning-fg">
        <div class="flex items-start justify-between gap-4">
          <div>{props.message}</div>
          <button
            type="button"
            class="motion-focus-surface ml-4 rounded-sm text-tone-warning-fg underline underline-offset-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label={t(keys.shipmentView.alerts.action.dismissActionError)}
            onClick={() => props.onDismiss()}
          >
            {t(keys.createProcess.action.dismiss)}
          </button>
        </div>
      </div>
    </div>
  )
}
