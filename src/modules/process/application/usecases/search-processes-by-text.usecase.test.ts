import { describe, expect, it, vi } from 'vitest'

import type {
  InsertProcessRecord,
  UpdateProcessRecord,
} from '~/modules/process/application/process.records'
import type { ProcessRepository } from '~/modules/process/application/process.repository'
import { createSearchProcessesByTextUseCase } from '~/modules/process/application/usecases/search-processes-by-text.usecase'
import { toCarrierCode } from '~/modules/process/domain/identity/carrier-code.vo'
import { toProcessId } from '~/modules/process/domain/identity/process-id.vo'
import { toProcessReference } from '~/modules/process/domain/identity/process-reference.vo'
import { toProcessSource } from '~/modules/process/domain/identity/process-source.vo'
import { createProcessEntity, type ProcessEntity } from '~/modules/process/domain/process.entity'

function createProcess(overrides: {
  readonly id: string
  readonly reference?: string | null
  readonly importerName?: string | null
  readonly billOfLading?: string | null
  readonly carrier?: string | null
}): ProcessEntity {
  return createProcessEntity({
    id: toProcessId(overrides.id),
    reference:
      overrides.reference === null ? null : toProcessReference(overrides.reference ?? 'REF-1'),
    origin: null,
    destination: null,
    carrier: overrides.carrier === null ? null : toCarrierCode(overrides.carrier ?? 'MSC'),
    billOfLading: overrides.billOfLading ?? null,
    bookingNumber: null,
    importerName: overrides.importerName ?? null,
    exporterName: null,
    referenceImporter: null,
    product: null,
    redestinationNumber: null,
    operationalWorkflowState: 'WAITING_BL',
    source: toProcessSource('manual'),
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
  })
}

function createRepository(processes: readonly ProcessEntity[]): ProcessRepository {
  return {
    fetchAll: vi.fn(async () => processes),
    fetchById: vi.fn(async (_processId: string) => null),
    create: vi.fn(async (_record: InsertProcessRecord) => {
      throw new Error('Not implemented in search tests')
    }),
    update: vi.fn(async (_processId: string, _record: UpdateProcessRecord) => {
      throw new Error('Not implemented in search tests')
    }),
    delete: vi.fn(async (_processId: string) => {
      throw new Error('Not implemented in search tests')
    }),
    updateWorkflowState: vi.fn(async (_processId: string) => {
      throw new Error('Not implemented in search tests')
    }),
  }
}

describe('createSearchProcessesByTextUseCase', () => {
  it('returns a process on exact reference match', async () => {
    const repository = createRepository([
      createProcess({
        id: 'process-exact',
        reference: 'REF-EXACT-123',
        importerName: 'Importer A',
        billOfLading: 'BL-EXACT',
        carrier: 'MAERSK',
      }),
      createProcess({
        id: 'process-other',
        reference: 'REF-OTHER-999',
        importerName: 'Importer B',
      }),
    ])

    const searchByText = createSearchProcessesByTextUseCase({ repository })

    const result = await searchByText('REF-EXACT-123', 10)

    expect(result).toEqual([
      {
        processId: 'process-exact',
        reference: 'REF-EXACT-123',
        importerName: 'Importer A',
        billOfLading: 'BL-EXACT',
        carrier: 'MAERSK',
      },
    ])
  })

  it('supports case-insensitive partial matching on reference, importer, BL and carrier', async () => {
    const repository = createRepository([
      createProcess({ id: 'process-reference', reference: 'REF-ALPHA-001' }),
      createProcess({ id: 'process-importer', importerName: 'Blue Wave Imports' }),
      createProcess({ id: 'process-bl', billOfLading: 'BL-778899' }),
      createProcess({ id: 'process-carrier', carrier: 'MAERSK' }),
    ])

    const searchByText = createSearchProcessesByTextUseCase({ repository })

    const matchByReference = await searchByText('alp', 10)
    const matchByImporter = await searchByText('wAvE', 10)
    const matchByBl = await searchByText('77', 10)
    const matchByCarrier = await searchByText('eRsK', 10)

    expect(matchByReference.map((item) => item.processId)).toEqual(['process-reference'])
    expect(matchByImporter.map((item) => item.processId)).toEqual(['process-importer'])
    expect(matchByBl.map((item) => item.processId)).toEqual(['process-bl'])
    expect(matchByCarrier.map((item) => item.processId)).toEqual(['process-carrier'])
  })

  it('respects the provided result limit after matching', async () => {
    const repository = createRepository([
      createProcess({ id: 'process-1', reference: 'REF-LIMIT-001' }),
      createProcess({ id: 'process-2', reference: 'REF-LIMIT-002' }),
      createProcess({ id: 'process-3', reference: 'REF-LIMIT-003' }),
    ])

    const searchByText = createSearchProcessesByTextUseCase({ repository })

    const result = await searchByText('ref-limit', 2)

    expect(result.map((item) => item.processId)).toEqual(['process-1', 'process-2'])
    expect(result).toHaveLength(2)
  })
})
