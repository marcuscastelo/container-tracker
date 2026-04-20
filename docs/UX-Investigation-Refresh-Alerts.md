# Container Tracker — UX Investigation

This document captures investigation results about refresh/sync, dashboard behavior, alerts, acknowledge behavior, redestination, ETA rendering and typography.

---

## Topic: Refresh Button

Component: Dashboard "Sincronizar" button
File: `src/modules/process/ui/components/DashboardRefreshButton.tsx`

Snippet:

```tsx
// src/modules/process/ui/components/DashboardRefreshButton.tsx
export function DashboardRefreshButton(props: RefreshButtonProps): JSX.Element {
  ...
  const handleClick = async () => {
    if (isBlocked()) {
      return
    }

    const clickStartedAtMs = Date.now()
    const nextCooldownUntilMs = toDashboardRefreshCooldownUntilMs(clickStartedAtMs)
    setCooldownUntilMs(nextCooldownUntilMs)
    scheduleCooldownRelease(nextCooldownUntilMs)

    setIsLoading(true)
    setVisualState('loading')

    try {
      await props.onRefresh()
      setVisualState('idle')
    } catch (error) {
      console.error('Dashboard sync failed:', error)
      setVisualState('error')
    } finally {
      setIsLoading(false)
    }
  }
  ...
  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={isBlocked()}
      aria-busy={isLoading()}
      title={buttonTitle()}
      class="inline-flex items-center gap-2 rounded-md ... disabled:opacity-70"
    >
      <RefreshIcon ... />
      <span>{buttonLabel()}</span>
    </button>
  )
}
```

Explanation:
- `DashboardRefreshButton` component renders "Sincronizar" UI (label from i18n keys). It implements cooldown (`DASHBOARD_REFRESH_COOLDOWN_MS`), visual states (`'idle' | 'loading' | 'error'`), blocking while loading, and spinner/icon for loading. On click it calls provided `onRefresh` prop and shows loading/error state.

---

## Topic: Process View Refresh Icon

Component: Process View refresh icon & action
File: `src/modules/process/ui/components/ShipmentHeader.tsx` (RefreshButton inside)

Snippet:

```tsx
// src/modules/process/ui/components/ShipmentHeader.tsx
function RefreshButton(props: RefreshButtonProps): JSX.Element {
  const handleClick = () => {
    if (props.carrier === 'unknown') {
      props.onUnknownCarrier()
      return
    }
    props.onTriggerRefresh()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`rounded-md p-2 text-slate-500 hover:bg-slate-100 ${disabledClass()}`}
      title={props.title}
      aria-busy={props.isRefreshing}
      disabled={props.isRefreshing}
    >
      <RefreshIcon spinning={props.isRefreshing} title={props.title} />
    </button>
  )
}
...
<RefreshButton
  isRefreshing={props.isRefreshing}
  carrier={props.data.carrier}
  title={t(keys.shipmentView.actions.refresh)}
  onTriggerRefresh={props.onTriggerRefresh}
  onUnknownCarrier={() => setShowUnknownCarrierDialog(true)}
/>
```

Explanation:
- `ShipmentHeader` renders refresh icon for Process (Shipment) view using `RefreshButton`. button disables itself and shows spinning icon (`aria-busy`) when `isRefreshing` is true. Clicking triggers `props.onTriggerRefresh()` unless carrier is `'unknown'` (then it opens dialog).

What function is called on click?
- `RefreshButton` calls `props.onTriggerRefresh()`.

Where `triggerRefresh` is implemented:
File: `src/modules/process/ui/ShipmentView.tsx`

Snippet:

```ts
// src/modules/process/ui/ShipmentView.tsx
const triggerRefresh = async () => {
  const doneAt = lastRefreshDoneAt()
  if (doneAt) {
    const elapsedMs = Date.now() - doneAt.getTime()
    if (elapsedMs < REFRESH_SOFT_BLOCK_WINDOW_MS) {
      setRefreshHint(...)
      return
    }
  }
  setRefreshHint(null)

  await refreshShipmentContainers({
    data: shipment(),
    setIsRefreshing,
    setRefreshError,
    setRefreshHint,
    setRefreshRetry,
    setLastRefreshDoneAt,
    setRealtimeCleanup(...),
    refreshTrackingData,
    isDisposed: () => disposed,
    toTimeoutMessage: ...,
    toFailedMessage: ...,
  })
}
```

What endpoint/usecase is triggered?
- `refreshShipmentContainers` enqueues per-container sync requests by POSTing to `/api/refresh` and then polls / subscribes to `/api/refresh/status`. See `enqueueContainerRefresh` and `fetchRefreshSyncStatuses` in same file.

Key enqueue snippet (file: `ShipmentView.tsx`):
```ts
const response = await fetch('/api/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ container: containerNumber, carrier: carrier ?? null }),
})
```

And status polling:
```ts
const response = await fetch(`/api/refresh/status?${params.toString()}`, {
  cache: 'no-store',
  headers: {
    'cache-control': 'no-cache',
    pragma: 'no-cache',
  },
})
```

Does refresh update:
- entire process? No — refresh updates tracking-derived fields only (status, statusCode, eta, containers, alerts). See `refreshTrackingDataOnly` which applies only tracking-derived fields.
- specific container? POST `/api/refresh` is sent per container; enqueue is per-container and status tracked per sync request id.
- all processes? No — Process View refresh targets containers belonging to currently opened process.

Is there loading state?
- Yes. `isRefreshing` signal is used; `setIsRefreshing(true)` at start of `refreshShipmentContainers` and cleared in `finally`.

Is there visual feedback (spinner/disabled/toast)?
- Visual feedback present:
  - Spinner icon on refresh button (SVG with `animate-spin`) when refreshing.
  - `aria-busy` and `disabled` on button; CSS classes change (opacity / pointer-events).
  - `refreshHint` and `refreshRetry` textual hints shown in `ShipmentHeader` next to button.
  - `entry-client.tsx` contains delegated diagnostic handler that shows `alert()` messages and calls `/api/refresh` for elements with `button.refresh-button` (diagnostic code).

Files / lines referenced:
- Dashboard refresh button: `src/modules/process/ui/components/DashboardRefreshButton.tsx`
- Process view refresh icon: `src/modules/process/ui/components/ShipmentHeader.tsx` (RefreshButton and RefreshIcon)
- Trigger implementation: `src/modules/process/ui/ShipmentView.tsx` (triggerRefresh, refreshShipmentContainers, enqueueContainerRefresh, fetchRefreshSyncStatuses)
- Delegated client handler (diagnostic): `src/entry-client.tsx`

---

## Topic: Dashboard refresh scope

Component(s) / files:
- `src/modules/process/ui/screens/DashboardScreen.tsx`
- `src/modules/process/ui/utils/dashboard-refresh.ts`
- `src/modules/process/ui/api/processSync.api.ts`

Key code snippets:
```tsx
// DashboardScreen.tsx — wiring
<DashboardRefreshButton onRefresh={handleDashboardRefresh} />
...
const handleDashboardRefresh = async () => {
  await refreshDashboardData({
    syncAllProcesses: syncAllProcessesRequest,
    refetchProcesses,
    refetchGlobalAlerts,
  })
}
```

```ts
// src/modules/process/ui/utils/dashboard-refresh.ts
export async function refreshDashboardData(command: DashboardRefreshCommand): Promise<void> {
  await Promise.resolve(command.syncAllProcesses())

  const results = await Promise.allSettled([
    Promise.resolve(command.refetchProcesses()),
    Promise.resolve(command.refetchGlobalAlerts()),
  ])

  const hasFailure = results.some((result) => result.status === 'rejected')
  if (!hasFailure) {
    return
  }

  const firstRejectedReason = toFirstRejectedReason(results)
  if (firstRejectedReason instanceof Error) {
    throw firstRejectedReason
  }

  throw new Error('Dashboard refresh failed')
}
```

```ts
// src/modules/process/ui/api/processSync.api.ts
export async function syncAllProcessesRequest(): Promise<...> {
  return typedFetch('/api/processes/sync', { method: 'POST' }, SyncAllProcessesResponseSchema)
}
```

Which endpoint returns dashboard data?
- Dashboard process rows: `GET /api/processes` (used by `fetchDashboardProcessSummaries`).
- Dashboard global alerts summary: `GET /api/dashboard/operational-summary` (used by `fetchDashboardGlobalAlertsSummary`).

Is dashboard auto-refreshing?
- Not in UI code. Dashboard uses `createResource` to load read models and realtime hook `useProcessSyncRealtime` to show ephemeral sync state, but no interval-based auto-refresh is implemented in `DashboardScreen.tsx`.

Does "Sincronizar" button refresh:
- all processes? Yes — it calls `syncAllProcessesRequest()` (POST `/api/processes/sync`) to run global sync.
- visible rows? After sync it performs `refetchProcesses()` which reloads processes listing affecting visible rows.
- selected processes? Per-row sync exists (`syncProcessRequest(processId)` POST `/api/processes/:id/sync`) for single-process sync; but dashboard "Sincronizar" triggers global sync.

Is refresh implemented:
- HTTP call — yes. UI triggers HTTP endpoints (`POST /api/processes/sync`) and then refetches read models (`GET /api/processes`, `GET /api/dashboard/operational-summary`). Server-side may run background work but UI uses HTTP.

Files / lines referenced:
- `src/modules/process/ui/screens/DashboardScreen.tsx` (DashboardRefreshButton wiring)
- `src/modules/process/ui/utils/dashboard-refresh.ts` (refresh orchestration)
- `src/modules/process/ui/api/processSync.api.ts` (syncAllProcessesRequest -> POST `/api/processes/sync`)
- process controllers: `src/routes/api/processes/sync.ts` → `processControllers.syncAllProcesses`

---

## Topic: Alerts rendering

Which component renders alerts in Process View?
- `AlertsPanel` (`src/modules/process/ui/components/AlertsPanel.tsx`) composes `AlertsList` to render active and archived alerts. `AlertsPanel` is rendered inside `ShipmentDataView` in `ShipmentView`.

Snippet:
```tsx
// ShipmentView.tsx (render)
<AlertsPanel
  activeAlerts={props.activeAlerts}
  archivedAlerts={props.archivedAlerts}
  busyAlertIds={props.busyAlertIds}
  collapsingAlertIds={props.collapsingAlertIds}
  onAcknowledge={props.onAcknowledgeAlert}
  onUnacknowledge={props.onUnacknowledgeAlert}
/>
```

Where are alerts positioned relative to process header / container selector / timeline?
- `ShipmentDataView` layout: `ShipmentHeader` (header) → `OperationalSummaryStrip` → grid where left column contains `AlertsPanel` (sticky top), then `ContainersPanel`, then `TimelinePanel`. So alerts appear below header and above container list and timeline.

Which props are passed to alert components?
- `activeAlerts`, `archivedAlerts`, `busyAlertIds`, `collapsingAlertIds`, `onAcknowledge`, `onUnacknowledge`.

Are alerts derived from Tracking alerts or Process operational alerts?
- Tracking alerts. process detail API (`getProcessById`) obtains alerts from `trackingUseCases.getContainerSummary` and returns them. UI consumes those tracking alerts.

Does UI apply any filtering?
- UI separates alerts into active (ackedAtIso === null) and archived (ackedAtIso!== null) and sorts them. No further filtering is applied in `AlertsList` beyond mode (active vs archived).

Files / lines referenced:
- `src/modules/process/ui/components/AlertsPanel.tsx`
- `src/modules/process/ui/components/AlertsList.tsx`
- `src/modules/process/interface/http/process.controllers.ts` (getProcessById uses `trackingUseCases` to obtain alerts)
- `src/modules/process/ui/ShipmentView.tsx` (wiring)

---

## Topic: Alert acknowledge behavior

Which component renders acknowledge button?
- `AlertsList` (`src/modules/process/ui/components/AlertsList.tsx`) renders acknowledge UI: small square button labeled "X" for active alerts and "Unacknowledge" text button for archived alerts.

Snippet:
```tsx
// src/modules/process/ui/components/AlertsList.tsx
<Show when={props.mode === 'active'} fallback={/* archived: Unacknowledge button */}>
  <button
    type="button"
    disabled={isBusy()}
    class="inline-flex h-6 w-6 ..."
    aria-label={t(keys.shipmentView.alerts.action.acknowledgeAria)}
    onClick={() => props.onAcknowledge(alert.id)}
  >
    X
  </button>
</Show>
```

What UI element is used (X button / icon / action)?
- Small square button with text "X" for acknowledge; archived alerts have text button for unacknowledge.

What function is called on click?
- `props.onAcknowledge(alert.id)` which is wired to `alertActions.acknowledgeAlert` in `ShipmentView`.

Which endpoint/usecase handles acknowledge?
- UI calls `acknowledgeTrackingAlertRequest(alertId)` which issues `PATCH /api/alerts` with `{ alert_id, action: 'acknowledge' }`.
- Server-side route `src/routes/api/alerts.ts` delegates PATCH to tracking controller `handleAlertAction`, which calls `trackingUseCases.acknowledgeAlert(alert_id)`.
- Usecase delegates to repository which updates `acked_at` (see `supabaseTrackingAlertRepository.acknowledge`).

Does acknowledge:
- delete alert? No. It updates `acked_at` timestamp (not delete).
- hide alert? It moves it from active set to archived (active lists filter `acked_at IS NULL`).
- mark seen? Semantically yes — it marks alert acknowledged by setting `acked_at`.

Is there any tooltip or label explaining action?
- Buttons include `aria-label` attributes using i18n keys (e.g., `keys.shipmentView.alerts.action.acknowledgeAria`) to provide accessible labels; visual "X" button has no textual label beyond aria-label.

Files / lines referenced:
- `src/modules/process/ui/components/AlertsList.tsx`
- `src/modules/process/ui/validation/processApi.validation.ts` (acknowledgeTrackingAlertRequest -> PATCH /api/alerts)
- `src/routes/api/alerts.ts` -> `tracking.controllers.handleAlertAction`
- `src/modules/tracking/interface/http/tracking.controllers.ts` (handleAlertAction)
- `src/modules/tracking/infrastructure/persistence/supabaseTrackingAlertRepository.ts` (acknowledge updates `acked_at`)

---

## Topic: Redestination placement

Which ViewModel exposes `redestinationNumber`?
- `ProcessSummaryVM` in `src/modules/process/ui/viewmodels/process-summary.vm.ts` includes `readonly redestinationNumber?: string | null`.

Which UI component renders route in dashboard?
- `DashboardProcessTable.tsx` (function `DashboardProcessRow`) renders origin/destination and conditionally shows `redestinationNumber` below route.

Snippet:
```tsx
// src/modules/process/ui/components/DashboardProcessTable.tsx
<Show when={props.process.redestinationNumber}>
  <span class="text-[12px] text-slate-400">
    {t(keys.dashboard.table.routeRedestination)}: {props.process.redestinationNumber}
  </span>
</Show>
```

Is redestination mapped in UI mapper?
- Yes: `toProcessSummaryVMs` in `src/modules/process/ui/mappers/processList.ui-mapper.ts` maps API `redestination_number` to `redestinationNumber`.

Files / lines referenced:
- `src/modules/process/ui/viewmodels/process-summary.vm.ts`
- `src/modules/process/ui/mappers/processList.ui-mapper.ts`
- `src/modules/process/ui/components/DashboardProcessTable.tsx`

---

## Topic: ETA rendering

Which component renders ETA in dashboard table?
- `DashboardProcessTable.tsx` → `DashboardProcessRow` renders ETA column.

Snippet:
```tsx
// src/modules/process/ui/components/DashboardProcessTable.tsx
<td class="px-3 py-3 text-right">
  <Show when={props.process.eta} fallback={<span class="text-[14px] text-slate-300">—</span>}>
    <span class="text-[14px] font-bold tabular-nums text-slate-600">
      {displayEta(props.process.eta)}
    </span>
  </Show>
</td>
```

Is ETA styled differently from other fields?
- Yes. ETA is emphasized with `text-[14px] font-bold tabular-nums text-slate-600`, larger and bold compared to many other small meta fields (`text-[10px]` or `text-[11px]`).

What CSS classes are applied?
- `text-[14px] font-bold tabular-nums text-slate-600` for present ETA; fallback uses `text-[14px] text-slate-300`.

Is ETA part of ViewModel or formatted directly in component?
- ETA value is part of `ProcessSummaryVM` (`eta` field). component formats ETA via `displayEta` which calls `formatDateForLocale` — so ETA is provided by ViewModel and formatted in component.

Files / lines referenced:
- `src/modules/process/ui/components/DashboardProcessTable.tsx`
- `src/modules/process/ui/viewmodels/process-summary.vm.ts`
- `src/modules/process/ui/mappers/processList.ui-mapper.ts`

---

## Topic: Typography and scale

Inspect: `src/app.css` and class usage (Tailwind)

Evidence:
- Tailwind is used: `src/app.css` contains `@import "tailwindcss";` and `package.json` includes `tailwindcss` in devDependencies.
- No global font-size override found in `src/app.css` — project uses default browser/Tailwind base (16px) and explicit utility classes like `text-[10px]` and `text-[14px]` for granular control.

What is base font-size?
- No explicit override present; default browser/Tailwind base (typically 16px) applies.

Is Tailwind used?
- Yes (`@import "tailwindcss";` in `src/app.css` and dependency in `package.json`).

Are table rows using smaller typography?
- Yes. Table rows and meta fields use `text-[12px]`, `text-[11px]`, `text-[10px]` widely; ETA uses larger `text-[14px]`.

Are dashboards using custom CSS classes?
- Mostly Tailwind utility classes inline in components. `src/app.css` contains few project-specific rules (animations) but typography is controlled via Tailwind utilities.

Files / lines referenced:
- `src/app.css` (`@import "tailwindcss";`)
- `src/modules/process/ui/components/DashboardProcessTable.tsx` (ETA and text classes)
- `src/modules/process/ui/components/AlertsList.tsx` (badge sizes)
- `package.json` (tailwind dependency)

---

# Architecture Summary

- How dashboard data flows:
  - UI (`DashboardScreen`) loads read-models via `fetchDashboardProcessSummaries()` (`GET /api/processes`) and `fetchDashboardGlobalAlertsSummary()` (`GET /api/dashboard/operational-summary`).
  - Dashboard "Sincronizar" button calls `syncAllProcessesRequest()` (POST `/api/processes/sync`) and then triggers `refetchProcesses()` and `refetchGlobalAlerts()` to reload read models. Per-row sync uses `POST /api/processes/:id/sync` for single process.
  - Realtime hooks (`useProcessSyncRealtime`) supply ephemeral sync state, but canonical truth is served by server read-model endpoints.

- How alerts flow:
  - Alerts are created/derived by tracking domain and returned by process detail API (`getProcessById`) via `trackingUseCases.getContainerSummary`.
  - UI (`ShipmentView`) splits alerts into active and archived and renders via `AlertsPanel` -> `AlertsList`.
  - Acknowledge/unacknowledge: UI calls `PATCH /api/alerts` (via `acknowledgeTrackingAlertRequest`), server calls tracking usecases which update repository (set `acked_at`), UI reflects archived state (not deleted).

- How refresh works:
  - Process View refresh: enqueues per-container sync requests with POST `/api/refresh`, then polls `/api/refresh/status` and subscribes to realtime `sync_requests` events to detect terminal statuses. When done, UI refreshes tracking-derived fields by fetching process detail and applying only tracking-derived fields (status, statusCode, eta, containers, alerts).
  - Dashboard refresh: user click triggers POST `/api/processes/sync` then reloads read-models via `GET /api/processes` and `GET /api/dashboard/operational-summary`.

---

*Investigation saved to this document.*
