import { describe, expect, it } from 'vitest'
import {
  type CreateProcessCloseGuardFormSnapshot,
  createDefaultCreateProcessCloseGuardFormSnapshot,
  isCreateProcessCloseGuardFormDirty,
  isSmartPasteCloseGuardDirty,
} from '~/modules/process/ui/validation/createProcessCloseGuard.validation'

function createFormSnapshot(
  overrides?: Partial<CreateProcessCloseGuardFormSnapshot>,
): CreateProcessCloseGuardFormSnapshot {
  return {
    ...createDefaultCreateProcessCloseGuardFormSnapshot(),
    ...overrides,
  }
}

describe('createProcessCloseGuard.validation', () => {
  it('returns not dirty for untouched create form', () => {
    const baseline = createDefaultCreateProcessCloseGuardFormSnapshot()
    const current = createDefaultCreateProcessCloseGuardFormSnapshot()

    expect(isCreateProcessCloseGuardFormDirty({ baseline, current })).toBe(false)
  })

  it('returns dirty for changed create form', () => {
    const baseline = createDefaultCreateProcessCloseGuardFormSnapshot()
    const current = createFormSnapshot({ reference: 'CA074-25' })

    expect(isCreateProcessCloseGuardFormDirty({ baseline, current })).toBe(true)
  })

  it('returns not dirty when create form changes are reverted to baseline', () => {
    const baseline = createDefaultCreateProcessCloseGuardFormSnapshot()
    const changed = createFormSnapshot({ origin: 'Santos' })
    const reverted = createDefaultCreateProcessCloseGuardFormSnapshot()

    expect(isCreateProcessCloseGuardFormDirty({ baseline, current: changed })).toBe(true)
    expect(isCreateProcessCloseGuardFormDirty({ baseline, current: reverted })).toBe(false)
  })

  it('returns not dirty for unchanged edit form', () => {
    const baseline = createFormSnapshot({
      reference: 'CA074-25',
      origin: 'Shanghai',
      destination: 'Santos',
      containers: ['MRSU8798130'],
      carrier: 'maersk',
      billOfLading: 'EG0017057',
      bookingNumber: 'BOOK123',
      importerName: 'Importer A',
      exporterName: 'Exporter B',
      referenceImporter: 'PO-98765',
      product: 'Olives',
      redestinationNumber: '129495',
    })
    const current = createFormSnapshot({
      reference: 'CA074-25',
      origin: 'Shanghai',
      destination: 'Santos',
      containers: ['MRSU8798130'],
      carrier: 'maersk',
      billOfLading: 'EG0017057',
      bookingNumber: 'BOOK123',
      importerName: 'Importer A',
      exporterName: 'Exporter B',
      referenceImporter: 'PO-98765',
      product: 'Olives',
      redestinationNumber: '129495',
    })

    expect(isCreateProcessCloseGuardFormDirty({ baseline, current })).toBe(false)
  })

  it('returns dirty for changed edit form and container set', () => {
    const baseline = createFormSnapshot({
      reference: 'CA074-25',
      containers: ['MRSU8798130'],
      carrier: 'maersk',
    })
    const current = createFormSnapshot({
      reference: 'CA074-25',
      containers: ['MRSU8798130', 'CAAU7648798'],
      carrier: 'msc',
    })

    expect(isCreateProcessCloseGuardFormDirty({ baseline, current })).toBe(true)
  })

  it('returns not dirty for smart paste with no text and no parse result', () => {
    expect(
      isSmartPasteCloseGuardDirty({
        rawText: '',
        hasParsed: false,
      }),
    ).toBe(false)
  })

  it('returns dirty for smart paste with typed text or parse result', () => {
    expect(
      isSmartPasteCloseGuardDirty({
        rawText: 'REF: ABC-001',
        hasParsed: false,
      }),
    ).toBe(true)
    expect(
      isSmartPasteCloseGuardDirty({
        rawText: '',
        hasParsed: true,
      }),
    ).toBe(true)
  })
})
