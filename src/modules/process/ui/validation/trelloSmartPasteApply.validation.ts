import type { ParsedProcessDraft } from '~/modules/process/ui/validation/trelloSmartPaste.validation'

const CONTAINER_EXACT_REGEX = /^[A-Z]{4}[0-9]{7}$/
const MULTISPACE_REGEX = /\s+/g

const SMART_PASTE_SCALAR_FIELDS = [
  'reference',
  'importerName',
  'exporterName',
  'product',
  'referenceImporter',
  'redestinationNumber',
  'origin',
  'destination',
  'depositary',
  'billOfLading',
  'bookingNumber',
] as const

export type SmartPasteScalarField = (typeof SMART_PASTE_SCALAR_FIELDS)[number]

export type SmartPasteFormSnapshot = {
  readonly reference: string
  readonly importerName: string
  readonly exporterName: string
  readonly product: string
  readonly referenceImporter: string
  readonly redestinationNumber: string
  readonly origin: string
  readonly destination: string
  readonly depositary: string
  readonly billOfLading: string
  readonly bookingNumber: string
  readonly containers: readonly string[]
}

export type SmartPasteFieldConflict = {
  readonly field: SmartPasteScalarField
  readonly currentValue: string
  readonly importedValue: string
}

export type SmartPasteApplyPlan = {
  readonly scalarUpdates: Readonly<Partial<Record<SmartPasteScalarField, string>>>
  readonly conflicts: readonly SmartPasteFieldConflict[]
  readonly containers: readonly string[]
  readonly importedContainerCount: number
}

function normalizeText(value: string): string {
  return value.replace(MULTISPACE_REGEX, ' ').trim()
}

function normalizeTextComparison(value: string): string {
  return normalizeText(value).toLowerCase()
}

function normalizeContainer(value: string): string {
  return value.toUpperCase().replace(MULTISPACE_REGEX, '').trim()
}

function isValidContainer(value: string): boolean {
  return CONTAINER_EXACT_REGEX.test(value)
}

function dedupeContainers(values: readonly string[]): readonly string[] {
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const normalized = normalizeContainer(value)
    if (!isValidContainer(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    deduped.push(normalized)
  }

  return deduped
}

function mergeContainers(
  currentContainers: readonly string[],
  importedContainers: readonly string[],
): readonly string[] {
  const nextContainers = [...currentContainers]
  const normalizedCurrent = currentContainers
    .map((value) => normalizeContainer(value))
    .filter((value) => value.length > 0)
  const existing = new Set(normalizedCurrent)
  const importedUnique = dedupeContainers(importedContainers).filter(
    (value) => !existing.has(value),
  )
  if (importedUnique.length === 0) {
    return nextContainers.length > 0 ? nextContainers : ['']
  }

  let importIndex = 0
  for (let index = 0; index < nextContainers.length; index += 1) {
    const currentValue = normalizeContainer(nextContainers[index] ?? '')
    if (currentValue.length > 0) continue

    const imported = importedUnique[importIndex]
    if (!imported) break
    nextContainers[index] = imported
    importIndex += 1
  }

  while (importIndex < importedUnique.length) {
    const imported = importedUnique[importIndex]
    if (!imported) break
    nextContainers.push(imported)
    importIndex += 1
  }

  return nextContainers.length > 0 ? nextContainers : ['']
}

export function buildSmartPasteApplyPlan(params: {
  readonly current: SmartPasteFormSnapshot
  readonly draft: ParsedProcessDraft
}): SmartPasteApplyPlan {
  const scalarUpdates: Partial<Record<SmartPasteScalarField, string>> = {}
  const conflicts: SmartPasteFieldConflict[] = []

  for (const field of SMART_PASTE_SCALAR_FIELDS) {
    const importedRaw = params.draft.fields[field]
    if (!importedRaw) continue

    const importedValue = normalizeText(importedRaw)
    if (importedValue.length === 0) continue

    const currentValue = normalizeText(params.current[field])
    if (currentValue.length === 0) {
      scalarUpdates[field] = importedValue
      continue
    }

    if (normalizeTextComparison(currentValue) === normalizeTextComparison(importedValue)) {
      continue
    }

    conflicts.push({
      field,
      currentValue,
      importedValue,
    })
  }

  const nextContainers = mergeContainers(params.current.containers, params.draft.fields.containers)

  return {
    scalarUpdates,
    conflicts,
    containers: nextContainers,
    importedContainerCount: dedupeContainers(params.draft.fields.containers).length,
  }
}

export function applySmartPasteApplyPlan(params: {
  readonly current: SmartPasteFormSnapshot
  readonly plan: SmartPasteApplyPlan
  readonly overwriteConflicts: boolean
}): SmartPasteFormSnapshot {
  const getResolvedValue = (field: SmartPasteScalarField, currentValue: string): string => {
    const update = params.plan.scalarUpdates[field]
    if (update !== undefined) {
      return update
    }
    if (!params.overwriteConflicts) return currentValue
    const conflict = params.plan.conflicts.find((item) => item.field === field)
    if (!conflict) return currentValue
    return conflict.importedValue
  }

  return {
    reference: getResolvedValue('reference', params.current.reference),
    importerName: getResolvedValue('importerName', params.current.importerName),
    exporterName: getResolvedValue('exporterName', params.current.exporterName),
    product: getResolvedValue('product', params.current.product),
    referenceImporter: getResolvedValue('referenceImporter', params.current.referenceImporter),
    redestinationNumber: getResolvedValue(
      'redestinationNumber',
      params.current.redestinationNumber,
    ),
    origin: getResolvedValue('origin', params.current.origin),
    destination: getResolvedValue('destination', params.current.destination),
    depositary: getResolvedValue('depositary', params.current.depositary),
    billOfLading: getResolvedValue('billOfLading', params.current.billOfLading),
    bookingNumber: getResolvedValue('bookingNumber', params.current.bookingNumber),
    containers: params.plan.containers,
  }
}
