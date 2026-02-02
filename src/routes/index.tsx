import { A } from "@solidjs/router";
import { For, createSignal } from "solid-js";
import { getPoCShipments } from "~/lib/collections";
import type { Shipment } from "~/schemas/shipment.schema";

// Load PoC shipments from sample collections and map to UI shape
const shipments: Shipment[] = getPoCShipments()

const alerts = [
  { text: "Atraso: Navio MSC MEDU9876543 - Chegada atrasada.", time: "Há 2 horas" },
  { text: "Container OOLU5566778 - Liberado para retirada.", time: "Hoje 08:30" },
  { text: "Chegada: CMA CGM ECMU4567891 - Atravou em Paranaguá.", time: "Ontem 17:45" },
];

export default function Home() {
  const [loadingMap, setLoadingMap] = createSignal<Record<string, boolean>>({})

  async function refreshContainer(container: string) {
    setLoadingMap(prev => ({ ...(prev || {}), [container]: true }))
    try {
      const res = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        window.alert(`Refresh failed: ${res.status} ${res.statusText}\n${j?.error ?? ''}`)
      } else {
        window.alert(`Refresh OK — updated: ${j?.updatedPath ?? 'unknown'}`)
      }
    } catch (err: any) {
      console.error('refresh error', err)
      window.alert(`Refresh error: ${err?.message ?? String(err)}`)
    } finally {
      setLoadingMap(prev => ({ ...(prev || {}), [container]: false }))
    }
  }
  return (
    <main class="mx-auto text-gray-700 p-6 max-w-6xl">
      <header class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold flex items-center gap-3">
          <span class="bg-blue-700 text-white px-3 py-1 rounded">TMS Caseiro</span>
        </h1>
        <nav class="flex items-center gap-4 text-sm text-gray-600">
          <A href="#" class="hover:underline">Dashboard</A>
          <A href="#" class="hover:underline">Embarques</A>
          <A href="#" class="hover:underline">Containers</A>
        </nav>
      </header>

      {/* Metric cards */}
      <section class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white p-4 rounded shadow flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500">Embarques Ativos</div>
            <div class="text-2xl font-semibold">12</div>
          </div>
        </div>
        <div class="bg-white p-4 rounded shadow flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500">Containers em Trânsito</div>
            <div class="text-2xl font-semibold">8</div>
          </div>
        </div>
        <div class="bg-white p-4 rounded shadow flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500">Atrasos</div>
            <div class="text-2xl font-semibold text-red-600">2</div>
          </div>
        </div>
        <div class="bg-white p-4 rounded shadow flex items-center justify-between">
          <div>
            <div class="text-sm text-gray-500">Chegadas Hoje</div>
            <div class="text-2xl font-semibold">1</div>
          </div>
        </div>
      </section>

      <section class="bg-white rounded shadow p-4">
        <h2 class="text-lg font-semibold mb-4">Resumo dos Embarques</h2>

        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-sm text-gray-600">
              <th class="py-2 px-3">Processo</th>
              <th class="py-2 px-3">Cliente</th>
              <th class="py-2 px-3">Armador</th>
              <th class="py-2 px-3">BL / Contêiner</th>
              <th class="py-2 px-3">Origem → Destino</th>
              <th class="py-2 px-3">Status Atual</th>
              <th class="py-2 px-3">ETA</th>
            </tr>
          </thead>
          <tbody>
            <For each={shipments}>{(s: Shipment) => (
              <tr class="border-t">
                <td class="py-3 px-3 font-mono text-sm">{s.process}</td>
                <td class="py-3 px-3">{s.client}</td>
                <td class="py-3 px-3 font-semibold">{s.carrier}</td>
                <td class="py-3 px-3 flex items-center gap-2">
                  <span>{s.container}</span>
                  <button
                    type="button"
                    title="Refresh"
                    class="p-1 rounded hover:bg-gray-100"
                    disabled={loadingMap()[s.container]}
                    onClick={(e) => { e.stopPropagation(); refreshContainer(s.container) }}
                  >
                    {/* show spinner when loading */}
                    {loadingMap()[s.container] ? (
                      <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                        <path d="M22 12a10 10 0 0 1-10 10" stroke-opacity="0.75"></path>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
                        <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
                      </svg>
                    )}
                  </button>
                </td>
                <td class="py-3 px-3">{s.route}</td>
                <td class="py-3 px-3">
                  <span class={`inline-block px-3 py-1 rounded text-xs ${s.statusClass ?? 'bg-gray-200'}`}>
                    {s.status}
                  </span>
                </td>
                <td class="py-3 px-3">{s.eta}</td>
              </tr>
            )}</For>
          </tbody>
        </table>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div class="lg:col-span-2 bg-white rounded shadow p-4">
          <h3 class="font-semibold mb-3">Linha do Tempo - Processo 2024-0321</h3>
          <div class="text-sm text-gray-600 mb-4">Uma representação simples do progresso do embarque.</div>
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
            <For each={alerts}>{(a) => (
              <li class="flex justify-between items-start">
                <div class="text-gray-700">{a.text}</div>
                <div class="text-gray-400 text-xs ml-3">{a.time}</div>
              </li>
            )}</For>
          </ul>
        </aside>
      </section>
    </main>
  );
}
