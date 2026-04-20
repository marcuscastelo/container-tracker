import { describe, expect, it } from 'vitest'
import type { ParsedProcessDraft } from '~/modules/process/ui/validation/trelloSmartPaste.validation'
import {
  applySmartPasteApplyPlan,
  buildSmartPasteApplyPlan,
  type SmartPasteFormSnapshot,
} from '~/modules/process/ui/validation/trelloSmartPasteApply.validation'

function createCurrentSnapshot(
  overrides?: Partial<SmartPasteFormSnapshot>,
): SmartPasteFormSnapshot {
  return {
    reference: '',
    importerName: '',
    exporterName: '',
    product: '',
    referenceImporter: '',
    redestinationNumber: '',
    origin: '',
    destination: '',
    depositary: '',
    billOfLading: '',
    bookingNumber: '',
    containers: [''],
    ...overrides,
  }
}

function createParsedDraft(overrides?: Partial<ParsedProcessDraft['fields']>): ParsedProcessDraft {
  return {
    fields: {
      containers: [],
      ...overrides,
    },
    unmappedFields: [],
    warnings: [],
  }
}

describe('trelloSmartPasteApply.validation', () => {
  it('fills empty fields, reports overwrite conflicts, and merges containers with dedupe', () => {
    const current = createCurrentSnapshot({
      importerName: 'Importador Atual',
      containers: ['', 'MSCU1234567'],
    })
    const draft = createParsedDraft({
      reference: 'CA074-25',
      importerName: 'NACOM GOYA',
      product: 'AZEITONA',
      depositary: 'MOVECTA',
      containers: ['MRSU8798130', 'MSCU1234567', 'CAAU7648798'],
    })

    const plan = buildSmartPasteApplyPlan({ current, draft })

    expect(plan.scalarUpdates).toEqual({
      reference: 'CA074-25',
      product: 'AZEITONA',
      depositary: 'MOVECTA',
    })
    expect(plan.conflicts).toEqual([
      {
        field: 'importerName',
        currentValue: 'Importador Atual',
        importedValue: 'NACOM GOYA',
      },
    ])
    expect(plan.containers).toEqual(['MRSU8798130', 'MSCU1234567', 'CAAU7648798'])
  })

  it('preserves distinct destination and depositary updates', () => {
    const current = createCurrentSnapshot()
    const draft = createParsedDraft({
      destination: 'Santos',
      depositary: 'Santos Brasil',
      containers: ['MSCU1234567'],
    })

    const plan = buildSmartPasteApplyPlan({ current, draft })

    expect(plan.scalarUpdates).toEqual({
      destination: 'Santos',
      depositary: 'Santos Brasil',
    })
  })

  it('applies plan without overwriting conflicts when overwriteConflicts=false', () => {
    const current = createCurrentSnapshot({
      importerName: 'Importador Atual',
      containers: [''],
    })
    const draft = createParsedDraft({
      importerName: 'NACOM GOYA',
      reference: 'CA074-25',
      containers: ['MRSU8798130'],
    })

    const plan = buildSmartPasteApplyPlan({ current, draft })
    const next = applySmartPasteApplyPlan({
      current,
      plan,
      overwriteConflicts: false,
    })

    expect(next.reference).toBe('CA074-25')
    expect(next.importerName).toBe('Importador Atual')
    expect(next.containers).toEqual(['MRSU8798130'])
  })

  it('applies plan and overwrites conflicts when overwriteConflicts=true', () => {
    const current = createCurrentSnapshot({
      importerName: 'Importador Atual',
      containers: [''],
    })
    const draft = createParsedDraft({
      importerName: 'NACOM GOYA',
      reference: 'CA074-25',
      containers: ['MRSU8798130'],
    })

    const plan = buildSmartPasteApplyPlan({ current, draft })
    const next = applySmartPasteApplyPlan({
      current,
      plan,
      overwriteConflicts: true,
    })

    expect(next.reference).toBe('CA074-25')
    expect(next.importerName).toBe('NACOM GOYA')
    expect(next.containers).toEqual(['MRSU8798130'])
  })

  it('ignores invalid containers and keeps current list when imported list has no valid value', () => {
    const current = createCurrentSnapshot({
      containers: ['MSCU1234567', ''],
    })
    const draft = createParsedDraft({
      containers: ['INVALIDO', '1234', ''],
    })

    const plan = buildSmartPasteApplyPlan({ current, draft })

    expect(plan.containers).toEqual(['MSCU1234567', ''])
  })
})
