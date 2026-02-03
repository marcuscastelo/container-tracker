import { createResource } from 'solid-js'
import { getPoCShipmentsAsync } from '~/lib/collections'
import type { Shipment } from '../../schemas/shipment.schema'
import HomeHeader from '../components/HomeHeader'
import MetricsCards from '../components/MetricsCards'
import ShipmentsTable from '../components/ShipmentsTable'
import TimelineAlerts from '../components/TimelineAlerts'

export default function Home() {
  // load shipments via internal API/bundled samples
  const [shipments] = createResource<Shipment[]>(getPoCShipmentsAsync, {
    initialValue: [],
  })

  async function refreshContainer(container: string, carrier: string) {
    try {
      console.debug('refreshContainer called for', container)
      alert(`Refreshing container ${container}...`)
      const res = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container, carrier }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        window.alert(`Refresh failed: ${res.status} ${res.statusText}\n${j?.error ?? ''}`)
      } else {
        window.alert(`Refresh OK — updated: ${j?.updatedPath ?? 'unknown'}`)
      }
    } catch (err) {
      console.error('refresh error', err)
      window.alert(`Refresh error: ${(err as Error)?.message ?? String(err)}`)
    }
  }

  return (
    <main class="mx-auto text-gray-700 p-6 max-w-6xl">
      <HomeHeader />
      <MetricsCards />
      <ShipmentsTable shipments={shipments() ?? []} onRefresh={refreshContainer} />
      <TimelineAlerts />
    </main>
  )
}
