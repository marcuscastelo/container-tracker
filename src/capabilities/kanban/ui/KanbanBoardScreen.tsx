import { A } from '@solidjs/router'
import { createMemo, createResource, createSignal, For } from 'solid-js'
import z from 'zod'
import { typedFetch } from '~/shared/api/typedFetch'
import { useTranslation } from '~/shared/localization/i18n'
import { AppHeader } from '~/shared/ui/AppHeader'

const WorkflowStateSchema = z.enum([
  'WAITING_BL',
  'ARRIVAL_FORECAST',
  'DELAYED_WAITING_CUSTOMS_PRESENCE',
  'WAITING_FUNDS',
  'WAITING_ICMS',
  'LOADING',
  'INVOICING',
])

const KanbanBoardSchema = z.object({
  items: z.array(
    z.object({
      processId: z.string(),
      reference: z.string().nullable(),
      carrier: z.string().nullable(),
      eta: z.string().nullable(),
      operationalWorkflowState: WorkflowStateSchema,
      containerCount: z.number(),
      statusSummary: z.string().nullable(),
      alertsCount: z.number(),
    }),
  ),
})

type WorkflowState = z.infer<typeof WorkflowStateSchema>
type BoardItem = z.infer<typeof KanbanBoardSchema>['items'][number]

const COLUMNS: readonly WorkflowState[] = [
  'WAITING_BL',
  'ARRIVAL_FORECAST',
  'DELAYED_WAITING_CUSTOMS_PRESENCE',
  'WAITING_FUNDS',
  'WAITING_ICMS',
  'LOADING',
  'INVOICING',
]

async function fetchBoard() {
  const response = await typedFetch('/api/kanban/processes', undefined, KanbanBoardSchema)
  return response.items
}

async function moveProcess(processId: string, targetState: WorkflowState) {
  await typedFetch(
    `/api/processes/${processId}/workflow`,
    {
      method: 'PATCH',
      body: JSON.stringify({ targetState }),
      headers: { 'Content-Type': 'application/json' },
    },
    z.object({ processId: z.string(), newState: WorkflowStateSchema }),
  )
}

export function KanbanBoardScreen() {
  const { t, keys } = useTranslation()
  const [items, { refetch }] = createResource(fetchBoard)
  const [movingProcessId, setMovingProcessId] = createSignal<string | null>(null)

  const grouped = createMemo(() => {
    const list = items() ?? []
    return COLUMNS.map((column) => ({
      column,
      items: list.filter((item) => item.operationalWorkflowState === column),
    }))
  })

  const labelByColumn = createMemo<Record<WorkflowState, string>>(() => ({
    WAITING_BL: t(keys.kanban.column.waitingBl),
    ARRIVAL_FORECAST: t(keys.kanban.column.arrivalForecast),
    DELAYED_WAITING_CUSTOMS_PRESENCE: t(keys.kanban.column.delayedWaitingCustomsPresence),
    WAITING_FUNDS: t(keys.kanban.column.waitingFunds),
    WAITING_ICMS: t(keys.kanban.column.waitingIcms),
    LOADING: t(keys.kanban.column.loading),
    INVOICING: t(keys.kanban.column.invoicing),
  }))

  async function handleMove(item: BoardItem, target: WorkflowState) {
    if (item.operationalWorkflowState === target) return
    setMovingProcessId(item.processId)
    try {
      await moveProcess(item.processId, target)
      await refetch()
    } finally {
      setMovingProcessId(null)
    }
  }

  return (
    <div class="min-h-screen bg-slate-950 text-slate-100">
      <AppHeader />
      <main class="mx-auto max-w-[1600px] p-4">
        <h1 class="mb-4 text-xl font-semibold">{t(keys.kanban.title)}</h1>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <For each={grouped()}>
            {(columnGroup) => (
              <div
                class="min-h-[360px] rounded-lg border border-slate-800 bg-slate-900 p-3"
                role="listbox"
                aria-label={labelByColumn()[columnGroup.column]}
                onDragOver={(event) => event.preventDefault()}
                onDrop={async (event) => {
                  event.preventDefault()
                  const processId = event.dataTransfer?.getData('text/process-id')
                  const item = (items() ?? []).find(
                    (candidate) => candidate.processId === processId,
                  )
                  if (!item) return
                  await handleMove(item, columnGroup.column)
                }}
              >
                <h2 class="mb-3 text-sm font-semibold text-slate-200">
                  {labelByColumn()[columnGroup.column]} ({columnGroup.items.length})
                </h2>
                <div class="space-y-2">
                  <For each={columnGroup.items}>
                    {(item) => (
                      <article
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer?.setData('text/process-id', item.processId)
                        }}
                        class="rounded-md border border-slate-700 bg-slate-800 p-2 text-xs"
                      >
                        <A
                          href={`/shipments/${item.processId}`}
                          class="font-semibold text-blue-300"
                        >
                          {item.reference ?? item.processId}
                        </A>
                        <p>ETA: {item.eta ?? '-'}</p>
                        <p>Status: {item.statusSummary ?? 'UNKNOWN'}</p>
                        <p>Containers: {item.containerCount}</p>
                        <p>Alerts: {item.alertsCount}</p>
                        <button
                          type="button"
                          class="mt-2 rounded bg-slate-700 px-2 py-1"
                          disabled={movingProcessId() === item.processId}
                          onClick={() => {
                            const current = COLUMNS.indexOf(item.operationalWorkflowState)
                            const next = COLUMNS[current + 1]
                            if (next) {
                              void handleMove(item, next)
                            }
                          }}
                        >
                          {t(keys.kanban.moveForward)}
                        </button>
                      </article>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </main>
    </div>
  )
}
