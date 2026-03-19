import { A, useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal, For, Show } from 'solid-js'
import { z } from 'zod'
import type { fetchDashboardProcessSummaries } from '~/modules/process/ui/api/process.api'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import { ShipmentDataView } from '~/modules/process/ui/components/ShipmentDataView'
import { fetchProcess } from '~/modules/process/ui/fetchProcess'
import { processStatusToRank } from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import {
  toSortedActiveAlerts,
  toSortedArchivedAlerts,
} from '~/modules/process/ui/screens/shipment/lib/shipmentAlerts.sorting'
import { nextDashboardSortSelection } from '~/modules/process/ui/viewmodels/dashboard-sort.service'
import type { DashboardSortField } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'
import type { ProcessSummaryVM } from '~/modules/process/ui/viewmodels/process-summary.vm'
import { typedFetch } from '~/shared/api/typedFetch'
import { DEFAULT_LOCALE } from '~/shared/localization/defaultLocale'

const SCENARIO_LAB_ENABLED = import.meta.env.DEV

const ScenarioSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['lifecycle', 'data_pathologies', 'process_aggregation']),
  stage: z.number().int().min(0).max(10),
  tags: z.array(z.string()),
  stepsCount: z.number().int().min(1),
  containersCount: z.number().int().min(1),
})

const ScenarioGroupSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  stage: z.number().int().min(0).max(10).nullable(),
  scenarioIds: z.array(z.string()),
})

const ScenarioStageSchema = z.object({
  stage: z.number().int().min(0).max(10),
  label: z.string(),
  title: z.string(),
})

const ScenarioCatalogResponseSchema = z.object({
  stages: z.array(ScenarioStageSchema),
  groups: z.array(ScenarioGroupSchema),
  scenarios: z.array(ScenarioSummarySchema),
})

const ScenarioLoadResponseSchema = z.object({
  ok: z.literal(true),
  result: z.object({
    scenarioId: z.string(),
    appliedStep: z.number().int().min(1),
    processId: z.string(),
    processReference: z.string(),
    stage: z.number().int().min(0).max(10),
    containerIds: z.array(z.string()),
    containerNumbers: z.array(z.string()),
    totalSnapshotsApplied: z.number().int().min(0),
  }),
})

type ScenarioCatalogResponse = z.infer<typeof ScenarioCatalogResponseSchema>
type ScenarioSummary = z.infer<typeof ScenarioSummarySchema>
type ScenarioLoadResult = z.infer<typeof ScenarioLoadResponseSchema>['result']

async function fetchScenarioCatalog(): Promise<ScenarioCatalogResponse> {
  return typedFetch('/api/dev/scenarios/catalog', undefined, ScenarioCatalogResponseSchema)
}

async function loadScenario(params: {
  scenarioId: string
  step: number
}): Promise<ScenarioLoadResult> {
  const payload = {
    scenario_id: params.scenarioId,
    step: params.step,
  }

  const response = await typedFetch(
    '/api/dev/scenarios/load',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    },
    ScenarioLoadResponseSchema,
  )

  return response.result
}

function StageProgressBar(props: {
  stages: readonly z.infer<typeof ScenarioStageSchema>[]
  activeStage: number | null
}): JSX.Element {
  return (
    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Progression 0 → 10</h2>
      <ol class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <For each={props.stages}>
          {(stage) => {
            const isActive = () => props.activeStage === stage.stage
            return (
              <li
                class={`rounded-lg border px-3 py-2 text-xs-ui ${
                  isActive()
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div class="font-semibold">{stage.label}</div>
                <div>{stage.title}</div>
              </li>
            )
          }}
        </For>
      </ol>
    </div>
  )
}

function ScenarioNavigator(props: {
  groups: readonly z.infer<typeof ScenarioGroupSchema>[]
  scenariosById: ReadonlyMap<string, ScenarioSummary>
  selectedScenarioId: string | null
  onSelectScenario: (scenarioId: string) => void
}): JSX.Element {
  return (
    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Scenario Navigator</h2>
      <div class="mt-3 space-y-4">
        <For each={props.groups}>
          {(group) => (
            <section>
              <h3 class="text-xs-ui font-semibold uppercase tracking-wide text-slate-500">
                {group.title}
              </h3>
              <p class="mt-1 text-micro text-slate-400">{group.description}</p>
              <div class="mt-2 space-y-1">
                <For each={group.scenarioIds}>
                  {(scenarioId) => {
                    const scenario = props.scenariosById.get(scenarioId)
                    if (!scenario) return null

                    const isSelected = () => props.selectedScenarioId === scenario.id

                    return (
                      <button
                        type="button"
                        class={`w-full rounded-md border px-3 py-2 text-left text-xs-ui transition-colors ${
                          isSelected()
                            ? 'border-blue-300 bg-blue-50 text-blue-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => props.onSelectScenario(scenario.id)}
                      >
                        <div class="font-medium">{scenario.title}</div>
                        <div class="mt-1 text-micro text-slate-500">{scenario.id}</div>
                      </button>
                    )
                  }}
                </For>
              </div>
            </section>
          )}
        </For>
      </div>
    </div>
  )
}

function ScenarioPlayback(props: {
  scenario: ScenarioSummary | null
  selectedStep: number
  isLoading: boolean
  loadError: string | null
  onPrevious: () => void
  onNext: () => void
  onLoad: () => Promise<void>
  canPrevious: boolean
  canNext: boolean
  loadResult: ScenarioLoadResult | null
}): JSX.Element {
  return (
    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Scenario Preview</h2>
      <Show
        when={props.scenario}
        fallback={<p class="mt-2 text-xs-ui text-slate-500">Select a scenario.</p>}
      >
        {(scenario) => (
          <>
            <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 class="text-sm-ui font-semibold text-slate-900">{scenario().title}</h3>
              <p class="mt-1 text-xs-ui text-slate-600">{scenario().description}</p>
              <div class="mt-2 flex flex-wrap gap-2 text-micro text-slate-500">
                <span>id: {scenario().id}</span>
                <span>stage: {scenario().stage}</span>
                <span>steps: {scenario().stepsCount}</span>
                <span>containers: {scenario().containersCount}</span>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs-ui font-medium text-slate-700 disabled:opacity-50"
                disabled={!props.canPrevious || props.isLoading}
                onClick={() => props.onPrevious()}
              >
                Previous
              </button>
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs-ui font-medium text-slate-700 disabled:opacity-50"
                disabled={!props.canNext || props.isLoading}
                onClick={() => props.onNext()}
              >
                Next
              </button>
              <button
                type="button"
                class="rounded-md bg-blue-600 px-3 py-2 text-xs-ui font-semibold text-white disabled:opacity-60"
                disabled={props.isLoading}
                onClick={() => {
                  void props.onLoad()
                }}
              >
                {props.isLoading ? 'Loading...' : 'Load Scenario Step'}
              </button>
              <span class="text-xs-ui text-slate-600">
                Step {props.selectedStep} of {scenario().stepsCount}
              </span>
            </div>

            <Show when={props.loadError}>
              {(error) => (
                <p class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs-ui text-red-700">
                  {error()}
                </p>
              )}
            </Show>

            <Show when={props.loadResult}>
              {(result) => (
                <div class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs-ui text-green-900">
                  <div>
                    Loaded process <code>{result().processReference}</code>
                  </div>
                  <div class="mt-1 flex flex-wrap gap-3">
                    <A class="underline" href={`/shipments/${result().processId}`}>
                      Open Shipment
                    </A>
                    <A class="underline" href="/">
                      Open Dashboard
                    </A>
                    <span>snapshots applied: {result().totalSnapshotsApplied}</span>
                  </div>
                </div>
              )}
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}

function DashboardPreview(props: {
  rowLoading: boolean
  rowError: unknown
  row: ReturnType<typeof fetchDashboardProcessSummaries> extends Promise<infer Item>
    ? Item extends readonly (infer VM)[]
      ? VM | null
      : null
    : null
  onOpenProcess: (processId: string) => void
}): JSX.Element {
  const [sortSelection, setSortSelection] =
    createSignal<ReturnType<typeof nextDashboardSortSelection>>(null)

  const rows = createMemo(() => {
    const row = props.row
    if (!row) return []
    return [row]
  })

  return (
    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Dashboard Row Preview</h2>
      <Show when={props.rowError && !props.rowLoading}>
        <p class="mt-2 text-xs-ui text-red-600">Failed to load dashboard row preview.</p>
      </Show>
      <Show when={!props.rowLoading && rows().length === 0}>
        <p class="mt-2 text-xs-ui text-slate-500">Load a scenario to preview dashboard row.</p>
      </Show>
      <Show when={rows().length > 0}>
        <div class="mt-3">
          <DashboardProcessTable
            processes={rows()}
            loading={props.rowLoading}
            hasError={Boolean(props.rowError)}
            hasActiveFilters={false}
            onCreateProcess={() => {}}
            onClearFilters={() => {}}
            sortSelection={sortSelection()}
            onSortToggle={(field: DashboardSortField) =>
              setSortSelection((current) => nextDashboardSortSelection(current, field))
            }
            onProcessSync={() => Promise.resolve()}
            onOpenProcess={props.onOpenProcess}
            onProcessIntent={() => {}}
          />
        </div>
      </Show>
    </div>
  )
}

function ShipmentPreview(props: {
  shipmentLoading: boolean
  shipmentError: unknown
  shipment: Awaited<ReturnType<typeof fetchProcess>> | null | undefined
  selectedContainerId: string
  onSelectContainer: (containerId: string) => void
}): JSX.Element {
  const activeAlerts = createMemo(() => {
    const shipment = props.shipment
    if (!shipment) return []
    return toSortedActiveAlerts(shipment.alerts)
  })

  const archivedAlerts = createMemo(() => {
    const shipment = props.shipment
    if (!shipment) return []
    return toSortedArchivedAlerts(shipment.alerts)
  })

  const selectedContainer = createMemo(() => {
    const shipment = props.shipment
    if (!shipment) return null

    const selected = shipment.containers.find(
      (container) => container.id === props.selectedContainerId,
    )
    return selected ?? shipment.containers[0] ?? null
  })

  return (
    <div class="rounded-xl border border-slate-200 bg-white p-4">
      <h2 class="text-sm-ui font-semibold text-slate-900">Shipment Preview</h2>
      <Show when={props.shipmentError && !props.shipmentLoading}>
        <p class="mt-2 text-xs-ui text-red-600">Failed to load shipment preview.</p>
      </Show>
      <Show when={!props.shipmentLoading && !props.shipment}>
        <p class="mt-2 text-xs-ui text-slate-500">
          Load a scenario to preview shipment timeline and alerts.
        </p>
      </Show>
      <Show when={props.shipment}>
        {(shipment) => (
          <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <ShipmentDataView
              data={shipment()}
              activeAlerts={activeAlerts()}
              archivedAlerts={archivedAlerts()}
              busyAlertIds={new Set<string>()}
              collapsingAlertIds={new Set<string>()}
              onAcknowledgeAlert={() => {}}
              onUnacknowledgeAlert={() => {}}
              onOpenEdit={() => {}}
              isRefreshing={false}
              refreshRetry={null}
              refreshHint={null}
              syncNow={new Date()}
              onTriggerRefresh={async () => {}}
              onNormalizeAutoContainers={async () => ({
                normalized: false,
                reason: 'no_changes_required',
                targetCarrierCode: null,
              })}
              selectedContainerId={selectedContainer()?.id ?? ''}
              onSelectContainer={props.onSelectContainer}
              selectedContainer={selectedContainer()}
            />
          </div>
        )}
      </Show>
    </div>
  )
}

export default function TrackingScenariosPage(): JSX.Element {
  const navigate = useNavigate()

  const [catalog] = createResource(
    () => SCENARIO_LAB_ENABLED,
    async (enabled) => (enabled ? fetchScenarioCatalog() : null),
  )
  const [selectedScenarioId, setSelectedScenarioId] = createSignal<string | null>(null)
  const [selectedStep, setSelectedStep] = createSignal(1)
  const [loadingScenario, setLoadingScenario] = createSignal(false)
  const [loadError, setLoadError] = createSignal<string | null>(null)
  const [loadResult, setLoadResult] = createSignal<ScenarioLoadResult | null>(null)
  const [refreshToken, setRefreshToken] = createSignal(0)
  const [selectedContainerId, setSelectedContainerId] = createSignal('')

  const scenariosById = createMemo(() => {
    const data = catalog()
    const map = new Map<string, ScenarioSummary>()
    if (!data) return map

    for (const scenario of data.scenarios) {
      map.set(scenario.id, scenario)
    }

    return map
  })

  const selectedScenario = createMemo(() => {
    const scenarioId = selectedScenarioId()
    if (!scenarioId) return null
    return scenariosById().get(scenarioId) ?? null
  })

  const activeStage = createMemo(() => {
    const loaded = loadResult()
    if (loaded) return loaded.stage
    return selectedScenario()?.stage ?? null
  })

  createEffect(() => {
    const data = catalog()
    if (!data || data.scenarios.length === 0) return

    if (selectedScenarioId() !== null) return

    const firstScenario = data.scenarios[0]
    if (!firstScenario) return

    setSelectedScenarioId(firstScenario.id)
    setSelectedStep(1)
  })

  createEffect(() => {
    const scenario = selectedScenario()
    if (!scenario) return

    if (selectedStep() > scenario.stepsCount) {
      setSelectedStep(scenario.stepsCount)
    }

    if (selectedStep() < 1) {
      setSelectedStep(1)
    }
  })

  const [dashboardRow] = createResource(
    () => {
      const result = loadResult()
      if (!result) return null
      return { processId: result.processId, refresh: refreshToken() }
    },
    async (source) => {
      // Fetch a single process detail and map to a dashboard summary to avoid
      // loading the entire dashboard list for the preview.
      const shipment = await fetchProcess(source.processId, DEFAULT_LOCALE, {
        mode: 'network-only',
        dedupeInFlight: false,
      })

      if (!shipment) return null

      const containerNumbers = shipment.containers.map((c) => c.number.trim().toUpperCase())
      const hasTransshipment = shipment.containers.some((c) => c.transshipment?.hasTransshipment)

      // Derive a minimal ProcessSummaryVM from the full ShipmentDetailVM so the
      // Dashboard preview can render without fetching the full list.
      const highestSeverity = shipment.alerts.reduce<'danger' | 'warning' | 'info' | null>(
        (acc, a) => {
          if (acc === 'danger') return 'danger'
          if (a.severity === 'danger') return 'danger'
          if (a.severity === 'warning') return acc === 'info' || acc === null ? 'warning' : acc
          return acc === null ? 'info' : acc
        },
        null,
      )

      return {
        id: shipment.id,
        reference: shipment.reference ?? null,
        origin: { display_name: shipment.origin },
        destination: { display_name: shipment.destination },
        importerId: null,
        importerName: shipment.importer_name ?? null,
        exporterName: shipment.exporter_name ?? null,
        containerCount: shipment.containers.length,
        containerNumbers,
        status: shipment.status,
        statusCode: shipment.statusCode,
        statusMicrobadge: shipment.statusMicrobadge ?? null,
        statusRank: processStatusToRank(shipment.statusCode),
        eta: shipment.eta ?? null,
        etaMsOrNull: shipment.eta ? Date.parse(shipment.eta) : null,
        carrier: shipment.carrier ?? null,
        alertsCount: shipment.alerts.length,
        highestAlertSeverity: highestSeverity,
        dominantAlertCreatedAt: null,
        redestinationNumber: shipment.redestination_number ?? null,
        hasTransshipment,
        lastEventAt: null,
        syncStatus: 'idle' as const,
        lastSyncAt: null,
      } satisfies ProcessSummaryVM
    },
  )

  const [shipmentPreview] = createResource(
    () => {
      const result = loadResult()
      if (!result) return null
      return { processId: result.processId, refresh: refreshToken() }
    },
    async (source) =>
      fetchProcess(source.processId, DEFAULT_LOCALE, {
        mode: 'network-only',
        dedupeInFlight: false,
      }),
  )

  createEffect(() => {
    const shipment = shipmentPreview()
    if (!shipment) {
      setSelectedContainerId('')
      return
    }

    const selectedId = selectedContainerId()
    const selectedStillExists = shipment.containers.some((container) => container.id === selectedId)
    if (selectedStillExists) return

    setSelectedContainerId(shipment.containers[0]?.id ?? '')
  })

  const canGoPrevious = createMemo(() => selectedStep() > 1)
  const canGoNext = createMemo(() => {
    const scenario = selectedScenario()
    if (!scenario) return false
    return selectedStep() < scenario.stepsCount
  })

  async function handleLoadScenario(): Promise<void> {
    const scenarioId = selectedScenarioId()
    if (!scenarioId) return

    setLoadingScenario(true)
    setLoadError(null)

    try {
      const result = await loadScenario({
        scenarioId,
        step: selectedStep(),
      })

      setLoadResult(result)
      setRefreshToken((value) => value + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load scenario'
      setLoadError(message)
    } finally {
      setLoadingScenario(false)
    }
  }

  function selectScenario(scenarioId: string): void {
    setSelectedScenarioId(scenarioId)
    setSelectedStep(1)
    setLoadError(null)
  }

  return (
    <Show
      when={SCENARIO_LAB_ENABLED}
      fallback={
        <main class="mx-auto max-w-xl px-4 py-12">
          <section class="rounded-xl border border-slate-200 bg-white p-6">
            <h1 class="text-lg-ui font-semibold text-slate-900">Not found</h1>
            <p class="mt-2 text-xs-ui text-slate-600">
              Tracking Scenario Lab is available only in development environments.
            </p>
            <A class="mt-4 inline-block text-xs-ui font-medium text-blue-700 underline" href="/">
              Back to Dashboard
            </A>
          </section>
        </main>
      }
    >
      <div class="min-h-screen bg-slate-100">
        <main class="mx-auto max-w-350 space-y-4 px-3 py-4 sm:px-4 lg:px-6">
          <header class="rounded-xl border border-slate-200 bg-white p-4">
            <h1 class="text-lg-ui font-semibold text-slate-900">Tracking Scenario Lab</h1>
            <p class="mt-1 text-xs-ui text-slate-600">
              Multiverso progressivo de containers para validar timeline, status e alertas via
              pipeline real.
            </p>
          </header>

          <Show
            when={catalog()}
            fallback={
              <div class="rounded-xl border border-slate-200 bg-white p-4 text-xs-ui text-slate-500">
                Loading scenario catalog...
              </div>
            }
          >
            {(catalogData) => (
              <>
                <StageProgressBar stages={catalogData().stages} activeStage={activeStage()} />

                <div class="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div class="order-2 xl:order-1">
                    <ScenarioNavigator
                      groups={catalogData().groups}
                      scenariosById={scenariosById()}
                      selectedScenarioId={selectedScenarioId()}
                      onSelectScenario={selectScenario}
                    />
                  </div>

                  <div class="order-1 space-y-4 xl:order-2">
                    <ScenarioPlayback
                      scenario={selectedScenario()}
                      selectedStep={selectedStep()}
                      isLoading={loadingScenario()}
                      loadError={loadError()}
                      onPrevious={() => setSelectedStep((value) => Math.max(1, value - 1))}
                      onNext={() => {
                        const scenario = selectedScenario()
                        if (!scenario) return
                        setSelectedStep((value) => Math.min(scenario.stepsCount, value + 1))
                      }}
                      onLoad={handleLoadScenario}
                      canPrevious={canGoPrevious()}
                      canNext={canGoNext()}
                      loadResult={loadResult()}
                    />

                    <DashboardPreview
                      rowLoading={dashboardRow.loading}
                      rowError={dashboardRow.error}
                      row={dashboardRow() ?? null}
                      onOpenProcess={(processId) => {
                        void navigate(`/shipments/${processId}`)
                      }}
                    />

                    <ShipmentPreview
                      shipmentLoading={shipmentPreview.loading}
                      shipmentError={shipmentPreview.error}
                      shipment={shipmentPreview()}
                      selectedContainerId={selectedContainerId()}
                      onSelectContainer={(containerId) => setSelectedContainerId(containerId)}
                    />
                  </div>
                </div>
              </>
            )}
          </Show>
        </main>
      </div>
    </Show>
  )
}
