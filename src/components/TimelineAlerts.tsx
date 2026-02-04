import { For } from 'solid-js'

type Alert = {
  text: string
  time: string
}

export function TimelineAlerts(props: { alerts?: Alert[] }) {
  const alerts = props.alerts ?? [
    {
      text: 'Atraso: Navio MSC MEDU9876543 - Chegada atrasada.',
      time: 'Há 2 horas',
    },
    {
      text: 'Container OOLU5566778 - Liberado para retirada.',
      time: 'Hoje 08:30',
    },
    {
      text: 'Chegada: CMA CGM ECMU4567891 - Atravou em Paranaguá.',
      time: 'Ontem 17:45',
    },
  ]

  return (
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
      <div class="lg:col-span-2 bg-white rounded shadow p-4">
        <h3 class="font-semibold mb-3">Linha do Tempo - Processo 2024-0321</h3>
        <div class="text-sm text-gray-600 mb-4">
          Uma representação simples do progresso do embarque.
        </div>
        <div class="w-full">
          <div class="flex items-center gap-3 mb-2">
            <div class="flex-1 h-2 bg-gray-200 rounded relative">
              <div class="absolute top-0 left-0 h-2 w-3/4 bg-green-500 rounded"></div>
            </div>
          </div>
          <div class="flex justify-between text-xs text-gray-500">
            <div>15/04/2024</div>
            <div>Entrega Final</div>
          </div>
        </div>
      </div>

      <aside class="bg-white rounded shadow p-4">
        <h4 class="font-semibold mb-3">Alertas Recentes</h4>
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
