import { useTranslation } from '../i18n'

const keys = {
  activeShipments: 'metrics.activeShipments',
  inTransit: 'metrics.inTransit',
  delays: 'metrics.delays',
  arrivalsToday: 'metrics.arrivalsToday',
}

export function MetricsCards() {
  const { t } = useTranslation()
  return (
    <section class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
      <div class="bg-white p-4 rounded shadow flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-500">{t(keys.activeShipments)}</div>
          <div class="text-2xl font-semibold">12</div>
        </div>
      </div>
      <div class="bg-white p-4 rounded shadow flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-500">{t(keys.inTransit)}</div>
          <div class="text-2xl font-semibold">8</div>
        </div>
      </div>
      <div class="bg-white p-4 rounded shadow flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-500">{t(keys.delays)}</div>
          <div class="text-2xl font-semibold text-red-600">2</div>
        </div>
      </div>
      <div class="bg-white p-4 rounded shadow flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-500">{t(keys.arrivalsToday)}</div>
          <div class="text-2xl font-semibold">1</div>
        </div>
      </div>
    </section>
  )
}
