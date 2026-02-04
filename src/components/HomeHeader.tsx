import { A } from '@solidjs/router'
import { useTranslation } from '../i18n'

const keys = {
  brand: 'home.brand',
  dashboard: 'home.dashboard',
  shipments: 'home.shipments',
  containers: 'home.containers',
}

export function HomeHeader() {
  const { t } = useTranslation()
  return (
    <header class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold flex items-center gap-3">
        <span class="bg-blue-700 text-white px-3 py-1 rounded">{t(keys.brand)}</span>
      </h1>
      <nav class="flex items-center gap-4 text-sm text-gray-600">
        <A href="#" class="hover:underline">
          {t(keys.dashboard)}
        </A>
        <A href="#" class="hover:underline">
          {t(keys.shipments)}
        </A>
        <A href="#" class="hover:underline">
          {t(keys.containers)}
        </A>
      </nav>
    </header>
  )
}
