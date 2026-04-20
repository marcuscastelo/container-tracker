import { describe, expect, it } from 'vitest'
import { containerMappers } from '~/modules/container/infrastructure/persistence/container.persistence.mappers'

describe('container persistence mappers', () => {
  it('maps persistence rows into immutable container entities with value-object fields', () => {
    const entity = containerMappers.fromRow({
      id: 'container-1',
      process_id: 'process-1',
      container_number: 'MSCU1234567',
      carrier_code: 'msc',
      container_size: '40',
      container_type: 'HC',
      created_at: '2026-04-10T10:00:00.000Z',
      removed_at: null,
    })

    expect(entity.id).toBe('container-1')
    expect(entity.processId).toBe('process-1')
    expect(entity.containerNumber).toBe('MSCU1234567')
    expect(entity.carrierCode).toBe('msc')
    expect(entity.createdAt.toIsoString()).toBe('2026-04-10T10:00:00.000Z')
    expect(Object.isFrozen(entity)).toBe(true)
  })

  it('keeps insert records explicit about unset size/type persistence columns', () => {
    const row = containerMappers.toInsert({
      processId: 'process-1',
      containerNumber: 'MSCU1234567',
      carrierCode: 'msc',
    })

    expect(row).toEqual({
      carrier_code: 'msc',
      container_number: 'MSCU1234567',
      process_id: 'process-1',
      container_size: null,
      container_type: null,
    })
  })

  it('does not clear container size or type when mapping update records', () => {
    const row = containerMappers.toUpdate({
      id: 'container-1',
      containerNumber: 'DRYU2434190',
      carrierCode: 'one',
    })

    expect(row).toEqual({
      carrier_code: 'one',
      container_number: 'DRYU2434190',
    })
    expect(row).not.toHaveProperty('container_size')
    expect(row).not.toHaveProperty('container_type')
  })
})
