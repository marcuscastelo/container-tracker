import { expect, type Page, test } from 'playwright/test'

type AlertAction = 'acknowledge' | 'unacknowledge'

type AckScenarioState = {
  ackedAtIso: string | null
  detailRequestCount: number
  dashboardSummaryRequestCount: number
  dashboardProcessesRequestCount: number
}

type InstallApiMocksCommand = {
  readonly page: Page
  readonly processId: string
  readonly scenario: AckScenarioState
  readonly syncInProgress: boolean
}

const ACKED_AT_ISO = '2026-03-09T14:00:00.000Z'
const ALERT_ID = 'alert-ack-1'
const PROCESS_ID = 'process-ack-ui'
const CONTAINER_ID = 'container-ack-ui'
const CONTAINER_NUMBER = 'MSCU7654321'
const ALERT_TRIGGERED_AT_ISO = '2026-03-09T10:00:00.000Z'

function createScenarioState(): AckScenarioState {
  return {
    ackedAtIso: null,
    detailRequestCount: 0,
    dashboardSummaryRequestCount: 0,
    dashboardProcessesRequestCount: 0,
  }
}

function isAlertAction(value: unknown): value is AlertAction {
  return value === 'acknowledge' || value === 'unacknowledge'
}

function parseAlertAction(requestBody: unknown): AlertAction | null {
  if (typeof requestBody !== 'object' || requestBody === null) return null
  const action = Reflect.get(requestBody, 'action')
  if (!isAlertAction(action)) return null
  return action
}

function buildProcessDetailResponse(command: {
  readonly processId: string
  readonly ackedAtIso: string | null
  readonly syncInProgress: boolean
  readonly updatedAtIso: string
}): Record<string, unknown> {
  return {
    id: command.processId,
    reference: 'REF-ACK-UI',
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    bill_of_lading: null,
    booking_number: null,
    importer_name: null,
    exporter_name: null,
    reference_importer: null,
    product: null,
    redestination_number: null,
    importer_id: null,
    source: 'api',
    created_at: '2026-03-09T09:00:00.000Z',
    updated_at: command.updatedAtIso,
    containers: [
      {
        id: CONTAINER_ID,
        container_number: CONTAINER_NUMBER,
        carrier_code: 'MSC',
        status: 'IN_TRANSIT',
        observations: [],
        timeline: [],
        operational: {
          status: 'IN_TRANSIT',
          eta: null,
          transshipment: {
            has_transshipment: false,
            count: 0,
            ports: [],
          },
          data_issue: false,
        },
      },
    ],
    alerts: [
      {
        id: ALERT_ID,
        container_number: CONTAINER_NUMBER,
        category: 'monitoring',
        type: 'ETA_MISSING',
        severity: 'warning',
        message_key: 'alerts.etaMissing',
        message_params: {},
        detected_at: ALERT_TRIGGERED_AT_ISO,
        triggered_at: ALERT_TRIGGERED_AT_ISO,
        retroactive: false,
        provider: 'msc',
        acked_at: command.ackedAtIso,
      },
    ],
    process_operational: {
      derived_status: 'IN_TRANSIT',
      eta_max: null,
      coverage: { total: 1, with_eta: 0 },
    },
    containersSync: [
      {
        containerNumber: CONTAINER_NUMBER,
        carrier: 'MSC',
        lastSuccessAt: null,
        lastAttemptAt: null,
        isSyncing: command.syncInProgress,
        lastErrorCode: null,
        lastErrorAt: null,
      },
    ],
  }
}

function buildDashboardProcessesResponse(command: {
  readonly processId: string
  readonly hasActiveAlert: boolean
}): readonly Record<string, unknown>[] {
  return [
    {
      id: command.processId,
      reference: 'REF-ACK-UI',
      origin: { display_name: 'Shanghai' },
      destination: { display_name: 'Santos' },
      carrier: 'msc',
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      product: null,
      redestination_number: null,
      importer_id: null,
      source: 'api',
      created_at: '2026-03-09T09:00:00.000Z',
      updated_at: '2026-03-09T09:00:00.000Z',
      containers: [{ id: CONTAINER_ID, container_number: CONTAINER_NUMBER, carrier_code: 'MSC' }],
      process_status: 'IN_TRANSIT',
      eta: null,
      alerts_count: command.hasActiveAlert ? 1 : 0,
      highest_alert_severity: command.hasActiveAlert ? 'warning' : null,
      dominant_alert_created_at: command.hasActiveAlert ? ALERT_TRIGGERED_AT_ISO : null,
      has_transshipment: false,
      last_event_at: ALERT_TRIGGERED_AT_ISO,
      last_sync_status: 'UNKNOWN',
      last_sync_at: null,
    },
  ]
}

function buildDashboardSummaryResponse(command: {
  readonly hasActiveAlert: boolean
}): Record<string, unknown> {
  return {
    generated_at: '2026-03-09T14:00:00.000Z',
    total_active_alerts: command.hasActiveAlert ? 1 : 0,
    by_severity: {
      danger: 0,
      warning: command.hasActiveAlert ? 1 : 0,
      info: 0,
      success: 0,
    },
    by_category: {
      eta: command.hasActiveAlert ? 1 : 0,
      movement: 0,
      customs: 0,
      status: 0,
      data: 0,
    },
    process_exceptions: command.hasActiveAlert
      ? [
          {
            process_id: PROCESS_ID,
            reference: 'REF-ACK-UI',
            origin: 'Shanghai',
            destination: 'Santos',
            derived_status: 'IN_TRANSIT',
            eta_current: null,
            dominant_severity: 'warning',
            dominant_alert_created_at: ALERT_TRIGGERED_AT_ISO,
            active_alert_count: 1,
          },
        ]
      : [],
  }
}

function toJsonResponse(body: Record<string, unknown> | readonly Record<string, unknown>[]): {
  readonly status: number
  readonly contentType: string
  readonly body: string
} {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

async function installApiMocks(command: InstallApiMocksCommand): Promise<void> {
  await command.page.route('**/api/alerts', async (route) => {
    const request = route.request()
    if (request.method() !== 'PATCH') {
      await route.continue()
      return
    }

    const body = request.postDataJSON()
    const action = parseAlertAction(body)

    if (action === 'acknowledge') {
      command.scenario.ackedAtIso = ACKED_AT_ISO
    } else if (action === 'unacknowledge') {
      command.scenario.ackedAtIso = null
    }

    await route.fulfill(
      toJsonResponse({
        ok: true,
        alert_id: ALERT_ID,
        action: action ?? 'acknowledge',
      }),
    )
  })

  await command.page.route('**/api/dashboard/operational-summary', async (route) => {
    command.scenario.dashboardSummaryRequestCount += 1
    await route.fulfill(
      toJsonResponse(
        buildDashboardSummaryResponse({
          hasActiveAlert: command.scenario.ackedAtIso === null,
        }),
      ),
    )
  })

  await command.page.route('**/api/processes*', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname === '/api/processes') {
      command.scenario.dashboardProcessesRequestCount += 1
      await route.fulfill(
        toJsonResponse(
          buildDashboardProcessesResponse({
            processId: command.processId,
            hasActiveAlert: command.scenario.ackedAtIso === null,
          }),
        ),
      )
      return
    }

    if (url.pathname === `/api/processes/${command.processId}`) {
      command.scenario.detailRequestCount += 1
      await route.fulfill(
        toJsonResponse(
          buildProcessDetailResponse({
            processId: command.processId,
            ackedAtIso: command.scenario.ackedAtIso,
            syncInProgress: command.syncInProgress,
            updatedAtIso: `2026-03-09T14:00:${String(command.scenario.detailRequestCount).padStart(2, '0')}.000Z`,
          }),
        ),
      )
      return
    }

    await route.continue()
  })
}

async function openShipmentWithMocks(page: Page, command: {
  readonly processId: string
  readonly scenario: AckScenarioState
  readonly syncInProgress: boolean
}): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('locale', 'en-US')
  })
  await installApiMocks({
    page,
    processId: command.processId,
    scenario: command.scenario,
    syncInProgress: command.syncInProgress,
  })
  await page.goto(`/shipments/${command.processId}`)
  await expect(page.getByTestId(`alert-ack-button-${ALERT_ID}`)).toBeVisible()
}

async function acknowledgeAlert(page: Page): Promise<void> {
  await page.getByTestId(`alert-ack-button-${ALERT_ID}`).click()
  await expect(page.getByTestId(`alert-ack-button-${ALERT_ID}`)).toHaveCount(0)
  await expect(page.getByTestId(`alert-unack-button-${ALERT_ID}`)).toBeVisible()
}

test.describe('ACK state reconciliation', () => {
  test('test 1 - ACK imediato atualiza UI e reduz alertas ativos', async ({ page }) => {
    const scenario = createScenarioState()
    await openShipmentWithMocks(page, {
      processId: PROCESS_ID,
      scenario,
      syncInProgress: false,
    })

    await acknowledgeAlert(page)
    await expect(page.getByTestId(`alert-item-${ALERT_ID}`)).toBeVisible()
  })

  test('test 2 - ACK + refetch (dashboard refresh) mantém estado reconhecido', async ({ page }) => {
    const scenario = createScenarioState()
    await openShipmentWithMocks(page, {
      processId: PROCESS_ID,
      scenario,
      syncInProgress: false,
    })

    await acknowledgeAlert(page)

    const summaryRequestsBefore = scenario.dashboardSummaryRequestCount
    await page.goto('/')
    await expect
      .poll(() => scenario.dashboardSummaryRequestCount, { timeout: 10_000 })
      .toBeGreaterThan(summaryRequestsBefore)

    await page.reload()
    await expect
      .poll(() => scenario.dashboardSummaryRequestCount, { timeout: 10_000 })
      .toBeGreaterThan(summaryRequestsBefore + 1)

    await page.goto(`/shipments/${PROCESS_ID}`)
    await expect(page.getByTestId(`alert-unack-button-${ALERT_ID}`)).toBeVisible()
    await expect(page.getByTestId(`alert-ack-button-${ALERT_ID}`)).toHaveCount(0)
  })

  test('test 3 - navegação dashboard ↔ shipment preserva ACK', async ({ page }) => {
    const scenario = createScenarioState()
    await openShipmentWithMocks(page, {
      processId: PROCESS_ID,
      scenario,
      syncInProgress: false,
    })

    await acknowledgeAlert(page)

    await page.goto('/')
    await expect
      .poll(() => scenario.dashboardProcessesRequestCount, { timeout: 10_000 })
      .toBeGreaterThan(0)

    await page.goto(`/shipments/${PROCESS_ID}`)
    await expect(page.getByTestId(`alert-unack-button-${ALERT_ID}`)).toBeVisible()
    await expect(page.getByTestId(`alert-ack-button-${ALERT_ID}`)).toHaveCount(0)
  })

  test('test 4 - ACK + realtime update simulado não reexibe alerta ativo', async ({ page }) => {
    const scenario = createScenarioState()
    await openShipmentWithMocks(page, {
      processId: PROCESS_ID,
      scenario,
      syncInProgress: true,
    })

    await acknowledgeAlert(page)

    const detailRequestsAfterAck = scenario.detailRequestCount
    await expect
      .poll(() => scenario.detailRequestCount, {
        timeout: 15_000,
      })
      .toBeGreaterThan(detailRequestsAfterAck)

    await expect(page.getByTestId(`alert-unack-button-${ALERT_ID}`)).toBeVisible()
    await expect(page.getByTestId(`alert-ack-button-${ALERT_ID}`)).toHaveCount(0)
  })
})
