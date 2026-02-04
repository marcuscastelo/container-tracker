import { For } from 'solid-js'
import { useTranslation } from '../i18n'

type Alert = {
  text: string
  time: string
}

const keys = {
  timelineTitle: 'timeline.title',
  timelineDesc: 'timeline.description',
  timelineFinal: 'timeline.final',
  alertsTitle: 'timeline.alertsTitle',
}

export function TimelineAlerts(props: { alerts?: Alert[] }) {
  const { t } = useTranslation()
  const alerts = props.alerts ?? [
    {
      text: t('timeline.sample.delay', { ship: 'MSC MEDU9876543' }),
      time: t('timeline.sample.time.hours', { hours: 2 }),
    },
    {
      text: t('timeline.sample.released', { container: 'OOLU5566778' }),
      time: t('timeline.sample.time.today', { time: '08:30' }),
    },
    {
      text: t('timeline.sample.arrival', { ship: 'CMA CGM ECMU4567891', place: 'Paranaguá' }),
      time: t('timeline.sample.time.yesterday', { time: '17:45' }),
    },
  ]

  return (
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
      <div class="lg:col-span-2 bg-white rounded shadow p-4">
        <h3 class="font-semibold mb-3">{t(keys.timelineTitle)}</h3>
        <div class="text-sm text-gray-600 mb-4">{t(keys.timelineDesc)}</div>
        <div class="w-full">
          <div class="flex items-center gap-3 mb-2">
            <div class="flex-1 h-2 bg-gray-200 rounded relative">
              <div class="absolute top-0 left-0 h-2 w-3/4 bg-green-500 rounded"></div>
            </div>
          </div>
          <div class="flex justify-between text-xs text-gray-500">
            <div>{t('timeline.sample.date', { date: '15/04/2024' })}</div>
            <div>{t(keys.timelineFinal)}</div>
          </div>
        </div>
      </div>

      <aside class="bg-white rounded shadow p-4">
        <h4 class="font-semibold mb-3">{t(keys.alertsTitle)}</h4>
        <ul class="space-y-3 text-sm">
          <For each={alerts}>
            {(a) => (
              <li class="flex justify-between items-start">
                <div class="text-gray-700">{a.text}</div>
                <div class="text-gray-400 text-xs ml-3">{a.time}</div>
              </li>
            )}
          </For>
        </ul>
      </aside>
    </section>
  )
}
