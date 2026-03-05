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
      new Date('2026-03-03T10:00:00.000Z'),
    )

    expect(vm.state).toBe('error')
    expect(vm.relativeTimeAt).toBe('2026-03-02T10:00:00.000Z')
    expect(
      toContainerSyncLabel(vm, labelMessages, {
        now: new Date('2026-03-03T10:00:00.000Z'),
        locale: 'en-US',
      }).startsWith('failed '),
    ).toBe(true)
  })

  it('maps ok when success is present and no newer error exists', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        lastSuccessAt: '2026-03-02T10:00:00.000Z',
        lastErrorAt: '2026-03-01T10:00:00.000Z',
      }),
      new Date('2026-03-03T10:00:00.000Z'),
    )

    expect(vm.state).toBe('ok')
    expect(vm.relativeTimeAt).toBe('2026-03-02T10:00:00.000Z')
    expect(
      toContainerSyncLabel(vm, labelMessages, {
        now: new Date('2026-03-03T10:00:00.000Z'),
        locale: 'en-US',
      }).startsWith('updated '),
    ).toBe(true)
  })

  it('maps never when there is no success nor error history', () => {
    const vm = toContainerSyncVM(makeSyncDTO(), new Date('2026-03-03T10:00:00.000Z'))

    expect(vm.state).toBe('never')
    expect(vm.relativeTimeAt).toBeNull()
    expect(toContainerSyncLabel(vm, labelMessages)).toBe('never synced')
  })

  it('marks ok as stale after 24h threshold', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        lastSuccessAt: '2026-03-01T09:59:59.000Z',
      }),
      new Date('2026-03-02T10:00:00.000Z'),
    )

    expect(vm.state).toBe('ok')
    expect(vm.isStale).toBe(true)
  })

  it('updates relative label when now changes without refetch', () => {
    const vm = toContainerSyncVM(
      makeSyncDTO({
        lastSuccessAt: '2026-03-03T10:00:00.000Z',
      }),
      new Date('2026-03-03T10:00:00.000Z'),
    )

    const labelAtZero = toContainerSyncLabel(vm, labelMessages, {
      now: new Date('2026-03-03T10:00:00.000Z'),
      locale: 'en-US',
    })
    const labelAtOneMinute = toContainerSyncLabel(vm, labelMessages, {
      now: new Date('2026-03-03T10:01:00.000Z'),
      locale: 'en-US',
    })

    expect(labelAtZero).toContain('0 min')
    expect(labelAtOneMinute).toContain('1 min')
  })
})
