import { useTranslation } from '~/shared/localization/i18n'

export function RefreshErrorBanner(props: { message: string; onDismiss: () => void }) {
  const { t, keys } = useTranslation()
  return (
    <div class="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="rounded-md border border-red-200 bg-red-50 p-3 text-md-ui text-red-800">
        <div class="flex items-start justify-between gap-4">
          <div>{props.message}</div>
          <button
            type="button"
            class="ml-4 text-red-700 underline"
            aria-label={t(keys.createProcess.action.dismissError)}
            onClick={() => props.onDismiss()}
          >
            {t(keys.createProcess.action.dismiss)}
          </button>
        </div>
      </div>
    </div>
  )
}
