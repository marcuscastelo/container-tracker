import { describe, expect, it } from 'vitest'
import {
  findContainerIdByNumber,
  normalizeSelectedContainerNumber,
} from '~/modules/process/ui/screens/shipment/lib/shipmentContainerSelection'

describe('shipmentContainerSelection helpers', () => {
  it('normalizes preferred container query values', () => {
    expect(normalizeSelectedContainerNumber(' mscu1234567 ')).toBe('MSCU1234567')
    expect(normalizeSelectedContainerNumber('   ')).toBeNull()
    expect(normalizeSelectedContainerNumber(null)).toBeNull()
  })

  it('finds container id by container number case-insensitively', () => {
    expect(
      findContainerIdByNumber(
        [
          { id: 'container-1', number: 'MSCU1234567' },
          { id: 'container-2', number: 'MSCU7654321' },
        ],
        ' mscu7654321 ',
      ),
    ).toBe('container-2')
  })

  it('returns null when preferred container number is missing or not found', () => {
    expect(findContainerIdByNumber([{ id: 'container-1', number: 'MSCU1234567' }], null)).toBeNull()
    expect(
      findContainerIdByNumber([{ id: 'container-1', number: 'MSCU1234567' }], 'MSCU0000000'),
    ).toBeNull()
  })
})
