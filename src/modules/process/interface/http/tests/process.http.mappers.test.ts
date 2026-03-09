import { describe, expect, it } from 'vitest'
import { toUpdateProcessRecord } from '~/modules/process/interface/http/process.http.mappers'
import type { CreateProcessInput } from '~/modules/process/interface/http/process.schemas'

describe('process.http.mappers', () => {
  it('preserves explicit null values so update requests can clear process fields', () => {
    const dto: Partial<CreateProcessInput> = {
      reference: null,
      origin: null,
      destination: null,
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      product: null,
      redestination_number: null,
    }

    expect(toUpdateProcessRecord(dto)).toEqual({
      reference: null,
      origin: null,
      destination: null,
      bill_of_lading: null,
      booking_number: null,
      importer_name: null,
      exporter_name: null,
      reference_importer: null,
      product: null,
      redestination_number: null,
    })
  })

  it('omits untouched fields from update record payload', () => {
    expect(toUpdateProcessRecord({})).toEqual({})
  })
})
