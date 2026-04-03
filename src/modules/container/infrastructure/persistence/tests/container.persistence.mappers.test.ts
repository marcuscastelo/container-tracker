import { describe, expect, it } from 'vitest'
import { containerMappers } from '~/modules/container/infrastructure/persistence/container.persistence.mappers'

describe('container persistence mappers', () => {
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
