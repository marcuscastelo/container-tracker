import { describe, expect, it } from 'vitest'
import { serializeReportExport } from '~/capabilities/export-import/infrastructure/serializers/report.serializer'
import type { TemporalValueDto } from '~/shared/time/dto'

function instant(s: string | null): TemporalValueDto | null {
  return s === null ? null : { kind: 'instant', value: s }
}

function createReport(scope: 'all_processes' | 'single_process') {
  return {
    exportType: 'OPERATIONAL_SNAPSHOT' as const,
    exportedAt: '2026-03-15T10:00:00.000Z',
    timezone: 'UTC',
    scope,
    filters: {
      processId: scope === 'single_process' ? 'process-1' : null,
    },
    totals: {
      processCount: scope === 'single_process' ? 1 : 2,
      containerCount: 2,
      processesWithAlerts: 0,
      deliveredProcesses: 0,
      inTransitProcesses: 2,
      processesWithConflict: 0,
      processesWithoutRecentSync: 0,
    },
    methodologicalNotes: [],
    processes: [
      {
        id: 'process-1',
        reference: 'CA064-25',
        carrier: 'MSC',
        origin: 'Paquistão',
        destination: 'Santos',
        depositary: 'Santos Brasil',
        billOfLading: 'MEDUP6003834',
        importerName: 'FLUSH',
        exporterName: 'WAQAS',
        product: 'SAL',
        redestinationNumber: '128598',
        processStatus: 'ARRIVED_AT_POD',
        alertCount: 0,
        highestAlertSeverity: null,
        eta: instant('2026-04-30T00:00:00.000Z'),
        lastEventAt: instant('2026-04-20T16:18:00.000Z'),
        lastSyncAt: '2026-04-20T16:18:00.000Z',
        lastSyncStatus: 'DONE' as const,
        containers: [
          {
            id: 'container-1',
            containerNumber: 'FCIU2000205',
            carrierCode: 'MSC',
            status: 'IN_TRANSIT',
            eta: instant('2026-04-30T00:00:00.000Z'),
            latestEvent: instant('2026-04-20T16:18:00.000Z'),
            latestEventLabel: 'Discharged at destination port',
            latestTrackingUpdate: '2026-04-20T16:18:00.000Z',
            vesselName: 'MSC BIANCA SILVIA',
            hasConflict: false,
            uncertainty: null,
            alerts: [],
            timelineSummary: [],
          },
          {
            id: 'container-2',
            containerNumber: 'MSBU3493578',
            carrierCode: 'MSC',
            status: 'IN_TRANSIT',
            eta: instant('2026-04-30T00:00:00.000Z'),
            latestEvent: instant('2026-04-18T12:00:00.000Z'),
            latestEventLabel: 'Loaded on board',
            latestTrackingUpdate: '2026-04-18T12:00:00.000Z',
            vesselName: '',
            hasConflict: false,
            uncertainty: null,
            alerts: [],
            timelineSummary: [],
          },
        ],
      },
      {
        id: 'process-2',
        reference: 'CB111-25',
        carrier: 'MAERSK',
        origin: 'Brasil',
        destination: 'Rotterdam',
        depositary: null,
        billOfLading: null,
        importerName: null,
        exporterName: null,
        product: null,
        redestinationNumber: null,
        processStatus: 'IN_TRANSIT',
        alertCount: 0,
        highestAlertSeverity: null,
        eta: null,
        lastEventAt: null,
        lastSyncAt: null,
        lastSyncStatus: 'UNKNOWN' as const,
        containers: [],
      },
    ].slice(0, scope === 'single_process' ? 1 : 2),
  }
}

describe('serializeReportExport trello', () => {
  it('renders trello markdown for a single process with the operational template', async () => {
    const serialized = await serializeReportExport({
      report: createReport('single_process'),
      format: 'trello',
    })

    const markdown = Buffer.from(serialized.content).toString('utf-8')

    expect(serialized.filename).toBe('snapshot-CA064-25.md')
    expect(serialized.contentType).toContain('text/markdown')
    expect(markdown).toContain('# CA064-25')
    expect(markdown).toContain('## REF. CASTRO: CA064-25 - IMP: FLUSH - EXP: WAQAS - SAL')
    expect(markdown).toContain('NAVIO: MSC BIANCA SILVIA')
    expect(markdown).toContain('PREVISÃO: 2026-04-30')
    expect(markdown).toContain('BL: MEDUP6003834')
    expect(markdown).toContain('CTNR: FCIU2000205 / MSBU3493578')
    expect(markdown).toContain('ORIGEM: Paquistão')
    expect(markdown).toContain('DEPOSITARIO: Santos Brasil')
    expect(markdown).toContain('REDESTINACAO: 128598')
    expect(markdown).toContain('### Snapshot 2026-03-15')
    expect(markdown).toContain('process_status: ARRIVED_AT_POD')
    expect(markdown).toContain('last_event: Discharged at destination port')
    expect(markdown).toContain('alerts: []')
    expect(markdown).toContain('exported_at: 2026-03-15T10:00:00.000Z')
  })

  it('archives one markdown file per process for all-process trello export', async () => {
    const serialized = await serializeReportExport({
      report: createReport('all_processes'),
      format: 'trello',
    })

    const zipText = Buffer.from(serialized.content).toString('latin1')

    expect(serialized.filename).toBe('trello-export-2026-03-15.zip')
    expect(serialized.contentType).toBe('application/zip')
    expect(zipText).toContain('snapshot-CA064-25.md')
    expect(zipText).toContain('snapshot-CB111-25.md')
  })

  it('includes depositary in flat csv exports', async () => {
    const serialized = await serializeReportExport({
      report: createReport('single_process'),
      format: 'csv',
    })

    const csv = Buffer.from(serialized.content).toString('utf-8')

    expect(csv).toContain('process_reference,carrier,origin,destination,depositary,process_status')
    expect(csv).toContain('CA064-25,MSC,Paquistão,Santos,Santos Brasil,ARRIVED_AT_POD')
  })
})
