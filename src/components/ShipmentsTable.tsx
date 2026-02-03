import { For } from "solid-js";
import type { Shipment } from "../../schemas/shipment.schema";

type Props = {
  shipments: Shipment[];
  onRefresh: (container: string, carrier: string) => Promise<void> | void;
};

export default function ShipmentsTable(props: Props) {
  return (
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
          <For each={props.shipments}>{(s: Shipment) => (
            <tr class="border-t">
              <td class="py-3 px-3 font-mono text-sm">{s.process}</td>
              <td class="py-3 px-3">{s.client}</td>
              <td class="py-3 px-3 font-semibold">{s.carrier}</td>
              <td class="py-3 px-3 flex items-center gap-2">
                <span>{s.container}</span>
                <button
                  type="button"
                  title="Refresh"
                  class="p-1 rounded hover:bg-gray-100 refresh-button"
                  data-container={s.container}
                  data-carrier={s.carrier}
                  onClick={(e) => {
                    const el = e.currentTarget as HTMLElement
                    // if a delegated handler already handled this click, skip to avoid duplicate
                    if (el.dataset.delegateHandled === '1') {
                      console.debug('refresh click already handled by delegate', s.container)
                      // clear flag for future clicks
                      delete el.dataset.delegateHandled
                      return
                    }
                    e.stopPropagation();
                    console.debug('refresh button click', s.container);
                    try {
                      const r = props.onRefresh(s.container, s.carrier)
                      if (r && typeof (r as Promise<void>).catch === 'function') {
                        (r as Promise<void>).catch(() => {})
                      }
                    } catch (err) {
                      console.error('call refreshContainer failed', err)
                    }
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"></path>
                    <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"></path>
                  </svg>
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
  );
}
