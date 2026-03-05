import { describe, expect, it } from 'vitest'
import {
  toContainerSyncLabel,
  toContainerSyncVM,
} from '~/modules/process/ui/mappers/containerSync.ui-mapper'
import type { ProcessDetailResponse } from '~/shared/api-schemas/processes.schemas'

type ContainerSyncDTO = ProcessDetailResponse['containersSync'][number]

const labelMessages = {
  syncing: 'syncing…',
  never: 'never synced',
  updatedUnknownTime: 'updated',
  failedUnknownTime: 'failed',
  updated: (relative: string) => `updated ${relative}`,
  failed: (relative: string) => `failed ${relative}`,
}

function makeSyncDTO(overrides: Partial<ContainerSyncDTO> = {}): ContainerSyncDTO {
  return {
    containerNumber: 'MSCU1234567',
    carrier: 'msc',
    lastSuccessAt: null,
    lastAttemptAt: null,
    isSyncing: false,
    lastErrorCode: null,
    lastErrorAt: null,
    ...overrides,
  }
}

describe('container sync state mapping', () => {
  it('maps syncing when isSyncing=true', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        isSyncing: true,
        lastSuccessAt: '2026-03-01T10:00:00.000Z',
        lastErrorAt: '2026-03-02T10:00:00.000Z',
      }),
      'en-US',
      new Date('2026-03-03T10:00:00.000Z'),
    )

    expect(vm.state).toBe('syncing')
    expect(toContainerSyncLabel(vm, labelMessages)).toBe('syncing…')
  })

  it('maps error when lastErrorAt is newer than lastSuccessAt', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        lastSuccessAt: '2026-03-01T10:00:00.000Z',
        lastErrorAt: '2026-03-02T10:00:00.000Z',
      }),
      'en-US',
      new Date('2026-03-03T10:00:00.000Z'),
    )

    expect(vm.state).toBe('error')
    expect(vm.relativeTimeLabel).not.toBeNull()
    expect(toContainerSyncLabel(vm, labelMessages).startsWith('failed ')).toBe(true)
  })

  it('maps ok when success is present and no newer error exists', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        lastSuccessAt: '2026-03-02T10:00:00.000Z',
        lastErrorAt: '2026-03-01T10:00:00.000Z',
      }),
      'en-US',
      new Date('2026-03-03T10:00:00.000Z'),
    )

    expect(vm.state).toBe('ok')
    expect(vm.relativeTimeLabel).not.toBeNull()
    expect(toContainerSyncLabel(vm, labelMessages).startsWith('updated ')).toBe(true)
  })

  it('maps never when there is no success nor error history', () => {
    const vm = toContainerSyncVM(makeSyncDTO(), 'en-US', new Date('2026-03-03T10:00:00.000Z'))

    expect(vm.state).toBe('never')
    expect(vm.relativeTimeLabel).toBeNull()
    expect(toContainerSyncLabel(vm, labelMessages)).toBe('never synced')
  })

  it('marks ok as stale after 24h threshold', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        lastSuccessAt: '2026-03-01T09:59:59.000Z',
      }),
      'en-US',
      new Date('2026-03-02T10:00:00.000Z'),
    )

    expect(vm.state).toBe('ok')
    expect(vm.isStale).toBe(true)
  })
})
