import { expect, type Page, test } from 'playwright/test'

type EtaState = 'ACTUAL' | 'ACTIVE_EXPECTED' | 'EXPIRED_EXPECTED'

type OperationalEtaFixture = {
  readonly event_time: string
  readonly event_time_type: 'ACTUAL' | 'EXPECTED'
  readonly state: EtaState
  readonly type: string
  readonly location_code: string | null
  readonly location_display: string | null
}

type TransshipmentPortFixture = {
  readonly code: string
  readonly display: string | null
}

type TransshipmentFixture = {
  readonly has_transshipment: boolean
  readonly count: number
  readonly ports: readonly TransshipmentPortFixture[]
}

type ContainerOperationalFixture = {
  readonly status: string
  readonly eta: OperationalEtaFixture | null
  readonly transshipment: TransshipmentFixture
  readonly data_issue: boolean
}

type ContainerFixture = {
  readonly id: string
  readonly container_number: string
  readonly carrier_code: string
  readonly status: string
  readonly observations: readonly []
  readonly operational: ContainerOperationalFixture
}

type AlertFixture = {
  readonly id: string
  readonly container_number: string
  readonly category: 'fact' | 'monitoring'
  readonly type: string
  readonly severity: 'info' | 'warning' | 'danger'
  readonly message_key:
    | 'alerts.transshipmentDetected'
    | 'alerts.customsHoldDetected'
    | 'alerts.noMovementDetected'
    | 'alerts.etaMissing'
    | 'alerts.etaPassed'
    | 'alerts.portChange'
    | 'alerts.dataInconsistent'
  readonly message_params: Record<string, string | number>
  readonly detected_at: string
  readonly triggered_at: string
  readonly retroactive: boolean
  readonly provider: string | null
  readonly acked_at: string | null
}

type ProcessDetailFixture = {
  readonly id: string
  readonly reference: string
  readonly origin: { readonly display_name: string }
  readonly destination: { readonly display_name: string }
  readonly carrier: string
  readonly source: string
  readonly created_at: string
  readonly updated_at: string
  readonly containers: readonly ContainerFixture[]
  readonly alerts: readonly AlertFixture[]
  readonly process_operational: {
    readonly eta_max: OperationalEtaFixture | null
    readonly coverage: {
      readonly total: number
      readonly with_eta: number
    }
  }
}

type ContainerScenario = {
  readonly id: string
  readonly number: string
  readonly eta: {
    readonly state: EtaState
    readonly eventTimeIso: string
  } | null
  readonly transshipment: {
    readonly hasTransshipment: boolean
    readonly count: number
    readonly ports: readonly TransshipmentPortFixture[]
  }
  readonly dataIssue: boolean
}

type BuildFixtureParams = {
  readonly processId: string
  readonly containers: readonly ContainerScenario[]
  readonly alerts?: readonly AlertFixture[]
  readonly coverage?: {
    readonly total: number
    readonly withEta: number
  }
  readonly processEtaMax?: {
    readonly state: EtaState
    readonly eventTimeIso: string
  } | null
}

const ISO_CREATED_AT = '2026-03-01T10:00:00.000Z'

function toOperationalEta(
  value: { readonly state: EtaState; readonly eventTimeIso: string } | null,
): OperationalEtaFixture | null {
  if (!value) return null
  return {
    event_time: value.eventTimeIso,
    event_time_type: value.state === 'ACTUAL' ? 'ACTUAL' : 'EXPECTED',
    state: value.state,
    type: 'ARRIVAL',
    location_code: 'BRSSZ',
    location_display: 'Santos',
  }
}

function toContainerFixture(value: ContainerScenario): ContainerFixture {
  return {
    id: value.id,
    container_number: value.number,
    carrier_code: 'MSC',
    status: 'IN_TRANSIT',
    observations: [],
    operational: {
      status: 'IN_TRANSIT',
      eta: toOperationalEta(value.eta),
      transshipment: {
        has_transshipment: value.transshipment.hasTransshipment,
        count: value.transshipment.count,
        ports: value.transshipment.ports,
      },
      data_issue: value.dataIssue,
    },
  }
}

function buildFixture(params: BuildFixtureParams): ProcessDetailFixture {
  const withEta = params.containers.filter((container) => container.eta !== null).length
  const coverage = params.coverage ?? {
    total: params.containers.length,
    withEta,
  }
  const fallbackEtaMax =
    [...params.containers]
      .map((container) => container.eta)
      .filter((eta): eta is NonNullable<ContainerScenario['eta']> => eta !== null)
      .sort((a, b) => b.eventTimeIso.localeCompare(a.eventTimeIso))[0] ?? null

  return {
    id: params.processId,
    reference: `REF-${params.processId}`,
    origin: { display_name: 'Shanghai' },
    destination: { display_name: 'Santos' },
    carrier: 'msc',
    source: 'api',
    created_at: ISO_CREATED_AT,
    updated_at: ISO_CREATED_AT,
    containers: params.containers.map(toContainerFixture),
    alerts: params.alerts ?? [],
    process_operational: {
      eta_max: toOperationalEta(params.processEtaMax ?? fallbackEtaMax),
      coverage: {
        total: coverage.total,
        with_eta: coverage.withEta,
      },
    },
  }
}

function validateOperationalContract(payload: ProcessDetailFixture): void {
  expect(payload.process_operational).toBeDefined()
  expect(Object.keys(payload.process_operational).sort()).toEqual(['coverage', 'eta_max'])
  expect(Object.keys(payload.process_operational.coverage).sort()).toEqual(['total', 'with_eta'])

  for (const container of payload.containers) {
    expect(container.operational).toBeDefined()
    expect(Object.keys(container.operational).sort()).toEqual([
      'data_issue',
      'eta',
      'status',
      'transshipment',
    ])
  }
}

async function openProcessDetailWithFixture(
  page: Page,
  fixture: ProcessDetailFixture,
): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('locale', 'pt-BR')
  })

  await page.route(`**/api/processes/${fixture.id}*`, async (route) => {
    validateOperationalContract(fixture)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    })
  })

  await page.goto(`/shipments/${fixture.id}`)
  await expect(page.getByTestId('selected-eta-title')).toBeVisible()
}

function createContainerScenario(overrides: {
  readonly id: string
  readonly number: string
  readonly eta?: ContainerScenario['eta']
  readonly transshipment?: ContainerScenario['transshipment']
  readonly dataIssue?: boolean
}): ContainerScenario {
  return {
    id: overrides.id,
    number: overrides.number,
    eta: overrides.eta ?? null,
    transshipment: overrides.transshipment ?? {
      hasTransshipment: false,
      count: 0,
      ports: [],
    },
    dataIssue: overrides.dataIssue ?? false,
  }
}

test.describe('Process Detail QA', () => {
  test('header ETA - ACTUAL', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-actual',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU1000001',
          eta: { state: 'ACTUAL', eventTimeIso: '2026-02-13T10:00:00.000Z' },
        }),
      ],
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('selected-eta-title')).toHaveText(/Chegou 13\/02/)
    await expect(page.getByTestId('selected-eta-title')).not.toContainText('ETA')
    await expect(page.getByTestId('selected-eta-summary')).not.toContainText('Previsto')
    await expect(page.getByTestId('selected-eta-summary')).not.toContainText('Atrasado')
  })

  test('header ETA - ACTIVE_EXPECTED', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-active-expected',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU1000002',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-08T10:00:00.000Z' },
        }),
      ],
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('selected-eta-title')).toHaveText(/ETA 08\/03/)
    await expect(page.getByTestId('selected-eta-subtitle')).toHaveText('Previsto')
    await expect(page.getByTestId('selected-eta-title')).not.toContainText('Chegou')
  })

  test('header ETA - EXPIRED_EXPECTED', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-expired-expected',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU1000003',
          eta: { state: 'EXPIRED_EXPECTED', eventTimeIso: '2026-03-01T10:00:00.000Z' },
        }),
      ],
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('selected-eta-title')).toContainText('ETA')
    await expect(page.getByTestId('selected-eta-subtitle')).toHaveText('Atrasado')
  })

  test('header ETA - null', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-null-eta',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU1000004',
          eta: null,
        }),
      ],
      processEtaMax: null,
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('selected-eta-title')).toHaveText('ETA —')
    await expect(page.getByTestId('selected-eta-subtitle')).toHaveCount(0)
  })

  test('header ETA processo mostra coverage e incompleto quando parcial', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-process-coverage-partial',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU2000001',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-08T10:00:00.000Z' },
        }),
        createContainerScenario({
          id: 'c-2',
          number: 'MSCU2000002',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-10T10:00:00.000Z' },
        }),
        createContainerScenario({
          id: 'c-3',
          number: 'MSCU2000003',
          eta: null,
        }),
      ],
      coverage: { total: 3, withEta: 2 },
      processEtaMax: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-10T10:00:00.000Z' },
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('process-eta-summary')).toContainText('ETA (processo)')
    await expect(page.getByTestId('process-eta-coverage')).toHaveText('(2/3)')
    await expect(page.getByTestId('process-eta-incomplete')).toContainText('incompleto')
  })

  test('header ETA processo não mostra incompleto quando coverage total', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-process-coverage-full',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU3000001',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-08T10:00:00.000Z' },
        }),
        createContainerScenario({
          id: 'c-2',
          number: 'MSCU3000002',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-10T10:00:00.000Z' },
        }),
        createContainerScenario({
          id: 'c-3',
          number: 'MSCU3000003',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-12T10:00:00.000Z' },
        }),
      ],
      coverage: { total: 3, withEta: 3 },
      processEtaMax: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-12T10:00:00.000Z' },
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('process-eta-summary')).toContainText('ETA (processo)')
    await expect(page.getByTestId('process-eta-coverage')).toHaveText('(3/3)')
    await expect(page.getByTestId('process-eta-incomplete')).toHaveCount(0)
  })

  test('container chips exibem ETA/INT/Dados corretamente', async ({ page }) => {
    const fixture = buildFixture({
      processId: 'qa-container-chips',
      containers: [
        createContainerScenario({
          id: 'c-a',
          number: 'MSCU4000001',
          eta: { state: 'ACTUAL', eventTimeIso: '2026-02-13T10:00:00.000Z' },
          transshipment: {
            hasTransshipment: true,
            count: 2,
            ports: [
              { code: 'EGPSDTM', display: 'Port Said' },
              { code: 'ESBCN07', display: 'Barcelona' },
            ],
          },
        }),
        createContainerScenario({
          id: 'c-b',
          number: 'MSCU4000002',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-08T10:00:00.000Z' },
        }),
        createContainerScenario({
          id: 'c-c',
          number: 'MSCU4000003',
          eta: { state: 'EXPIRED_EXPECTED', eventTimeIso: '2026-03-01T10:00:00.000Z' },
          dataIssue: true,
        }),
        createContainerScenario({
          id: 'c-d',
          number: 'MSCU4000004',
          eta: null,
        }),
      ],
      coverage: { total: 4, withEta: 3 },
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('container-eta-chip-c-a')).toHaveText(/Chegou 13\/02/)
    await expect(page.getByTestId('container-eta-chip-c-b')).toHaveText(/ETA 08\/03/)
    await expect(page.getByTestId('container-eta-chip-c-c')).toHaveText(
      /ETA 01\/03(?:\/\d{4})? · Atrasado/,
    )
    await expect(page.getByTestId('container-eta-chip-c-d')).toHaveText('ETA —')
    await expect(page.getByTestId('container-int-chip-c-a')).toHaveText('INT 2')
    await expect(page.getByTestId('container-int-chip-c-b')).toHaveCount(0)
    await expect(page.getByTestId('container-data-chip-c-c')).toHaveText('Dados')
    await expect(page.getByTestId('container-data-chip-c-b')).toHaveCount(0)
    await expect(page.getByText(/^TS\b/)).toHaveCount(0)
  })

  test('card de portos intermediários não duplica alerta legado quando visível', async ({
    page,
  }) => {
    const fixture = buildFixture({
      processId: 'qa-transshipment-card',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU5000001',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-10T10:00:00.000Z' },
          transshipment: {
            hasTransshipment: true,
            count: 2,
            ports: [
              { code: 'EGPSDTM', display: 'Port Said' },
              { code: 'ESBCN07', display: 'Barcelona' },
            ],
          },
        }),
        createContainerScenario({
          id: 'c-2',
          number: 'MSCU5000002',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-11T10:00:00.000Z' },
        }),
      ],
      alerts: [
        {
          id: 'alert-ts',
          container_number: 'MSCU5000001',
          category: 'fact',
          type: 'TRANSSHIPMENT',
          severity: 'warning',
          message_key: 'alerts.transshipmentDetected',
          message_params: {
            port: 'EGPSDTM',
            fromVessel: 'VESSEL A',
            toVessel: 'VESSEL B',
          },
          detected_at: ISO_CREATED_AT,
          triggered_at: ISO_CREATED_AT,
          retroactive: false,
          provider: 'msc',
          acked_at: null,
        },
      ],
    })

    await openProcessDetailWithFixture(page, fixture)

    await expect(page.getByTestId('transshipment-card')).toBeVisible()
    await expect(page.getByTestId('transshipment-card')).toContainText('Portos intermediários')
    await expect(page.getByTestId('transshipment-card')).toContainText('2 portos')
    await expect(page.getByTestId('transshipment-card')).toContainText('EGPSDTM')
    await expect(page.getByTestId('transshipment-card')).toContainText('ESBCN07')
    await expect(page.getByText('Transbordo detectado')).toHaveCount(0)

    await page.getByTestId('container-card-c-2').click()
    await expect(page.getByTestId('transshipment-card')).toHaveCount(0)
    await expect(page.getByText('Transbordo detectado')).toHaveCount(1)
  })

  test('layout simples: sem overflow horizontal, chips compactos e coluna direita densa', async ({
    page,
  }) => {
    const fixture = buildFixture({
      processId: 'qa-layout-checks',
      containers: [
        createContainerScenario({
          id: 'c-1',
          number: 'MSCU6000001',
          eta: { state: 'ACTIVE_EXPECTED', eventTimeIso: '2026-03-10T10:00:00.000Z' },
          transshipment: {
            hasTransshipment: true,
            count: 2,
            ports: [
              { code: 'EGPSDTM', display: 'Port Said' },
              { code: 'ESBCN07', display: 'Barcelona' },
            ],
          },
        }),
        createContainerScenario({
          id: 'c-2',
          number: 'MSCU6000002',
          eta: { state: 'EXPIRED_EXPECTED', eventTimeIso: '2026-03-01T10:00:00.000Z' },
          dataIssue: true,
        }),
      ],
      alerts: [
        {
          id: 'alert-1',
          container_number: 'MSCU6000001',
          category: 'monitoring',
          type: 'NO_MOVEMENT',
          severity: 'warning',
          message_key: 'alerts.noMovementDetected',
          message_params: {
            days: 10,
            lastEventDate: '2026-02-20',
          },
          detected_at: ISO_CREATED_AT,
          triggered_at: ISO_CREATED_AT,
          retroactive: false,
          provider: 'msc',
          acked_at: null,
        },
      ],
    })

    await openProcessDetailWithFixture(page, fixture)

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })
    expect(hasHorizontalOverflow).toBe(false)

    const etaChipHeights = await page
      .locator('[data-testid^="container-eta-chip-"]')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
    for (const chipHeight of etaChipHeights) {
      expect(chipHeight).toBeLessThan(28)
    }

    const transshipmentBox = await page.getByTestId('transshipment-card').boundingBox()
    const alertsTitleBox = await page.getByText('Alertas').first().boundingBox()
    expect(transshipmentBox).not.toBeNull()
    expect(alertsTitleBox).not.toBeNull()
    if (transshipmentBox && alertsTitleBox) {
      const verticalGap = alertsTitleBox.y - (transshipmentBox.y + transshipmentBox.height)
      expect(verticalGap).toBeLessThanOrEqual(24)
    }
  })
})
