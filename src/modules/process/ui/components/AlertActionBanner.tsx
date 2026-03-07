import { useTranslation } from '~/shared/localization/i18n'

export function AlertActionBanner(props: { message: string; onDismiss: () => void }) {
  const { t, keys } = useTranslation()
  return (
    <div class="mx-auto mt-2 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="rounded-md border border-amber-200 bg-amber-50 p-3 text-md-ui text-amber-800">
        <div class="flex items-start justify-between gap-4">
          <div>{props.message}</div>
          <button
            type="button"
            class="ml-4 text-amber-700 underline"
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
