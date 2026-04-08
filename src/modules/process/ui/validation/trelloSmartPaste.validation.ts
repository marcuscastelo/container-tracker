// Require non-alphanumeric boundaries to avoid matching container-like substrings
// inside longer tokens (e.g. ABCD12345678 -> should not match ABCD1234567)
const CONTAINER_REGEX = /(?<![A-Za-z0-9])[A-Za-z]{4}\s*[0-9]{7}(?![A-Za-z0-9])/g
const LABEL_LINE_REGEX = /^\s*([A-Za-zÀ-ÿ0-9 ._/-]+?)\s*:\s*(.*?)\s*$/
const TITLE_SEGMENT_SPLIT_REGEX = /\s+-\s+/
const DIACRITICS_REGEX = /[\u0300-\u036f]/g
const MULTISPACE_REGEX = /\s+/g
const TITLE_LABEL_REGEX = /^T[IÍ]TULO\s*:?\s*(.*)$/i

export type ParsedUnmappedField = {
  readonly label: string
  readonly value: string
}

export type ParsedProcessDraft = {
  readonly fields: {
    readonly reference?: string
    readonly importerName?: string
    readonly exporterName?: string
    readonly product?: string
    readonly referenceImporter?: string
    readonly redestinationNumber?: string
    readonly origin?: string
    readonly destination?: string
    readonly depositary?: string
    readonly billOfLading?: string
    readonly bookingNumber?: string
    readonly carrier?: string
    readonly containers: readonly string[]
  }
  readonly unmappedFields: readonly ParsedUnmappedField[]
  readonly warnings: readonly string[]
}

type ParsedTitleFields = {
  readonly reference?: string
  readonly importerName?: string
  readonly exporterName?: string
  readonly product?: string
  readonly unmappedFields: readonly ParsedUnmappedField[]
}

type ParsedLineFields = {
  readonly scalar: {
    readonly reference?: string
    readonly importerName?: string
    readonly exporterName?: string
    readonly product?: string
    readonly referenceImporter?: string
    readonly redestinationNumber?: string
    readonly origin?: string
    readonly destination?: string
    readonly depositary?: string
    readonly billOfLading?: string
    readonly bookingNumber?: string
    readonly carrier?: string
  }
  readonly containers: readonly string[]
  readonly unmappedFields: readonly ParsedUnmappedField[]
}

type LabelClassification =
  | { readonly type: 'mapped'; readonly key: keyof ParsedLineFields['scalar'] }
  | { readonly type: 'containers' }
  | { readonly type: 'unmapped'; readonly label: string }
  | { readonly type: 'ignored' }

function normalizeWhitespace(value: string): string {
  return value.replace(MULTISPACE_REGEX, ' ').trim()
}

function normalizeLabelKey(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replaceAll('.', '')
    .toUpperCase()
}

function normalizeContainerNumber(value: string): string {
  return value.toUpperCase().replace(MULTISPACE_REGEX, '').trim()
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const value of values) {
    if (seen.has(value)) continue
    seen.add(value)
    deduped.push(value)
  }

  return deduped
}

function extractContainerNumbers(rawText: string): readonly string[] {
  const matches = rawText.match(CONTAINER_REGEX) ?? []
  return dedupeStrings(
    matches.map((value) => normalizeContainerNumber(value)).filter((value) => value.length > 0),
  )
}

function splitProductValueFromInlineVessel(rawValue: string): {
  readonly productValue: string
  readonly vesselValue?: string
} {
  const productWithInlineVesselMatch = rawValue.match(
    /^(?<productValue>.+?)\s*NAVIO\s*:\s*(?<vesselValue>.+)$/i,
  )
  const productValue = normalizeWhitespace(
    productWithInlineVesselMatch?.groups?.productValue ?? rawValue,
  )
  const vesselValue = normalizeWhitespace(productWithInlineVesselMatch?.groups?.vesselValue ?? '')

  return {
    productValue,
    ...(vesselValue.length === 0 ? {} : { vesselValue }),
  }
}

function toLabelClassification(rawLabel: string): LabelClassification {
  const normalized = normalizeLabelKey(rawLabel)

  if (normalized === 'REF' || normalized === 'REFERENCIA') {
    return { type: 'mapped', key: 'reference' }
  }
  if (normalized === 'IMP' || normalized === 'IMPORTADOR') {
    return { type: 'mapped', key: 'importerName' }
  }
  if (normalized === 'EXP' || normalized === 'EXPORTADOR') {
    return { type: 'mapped', key: 'exporterName' }
  }
  if (normalized === 'PRODUTO') {
    return { type: 'mapped', key: 'product' }
  }
  if (
    normalized === 'REFERENCIA IMPORTADOR' ||
    normalized === 'REF IMPORTADOR' ||
    normalized === 'IMPORTER REFERENCE'
  ) {
    return { type: 'mapped', key: 'referenceImporter' }
  }
  if (normalized === 'ORIGEM') {
    return { type: 'mapped', key: 'origin' }
  }
  if (normalized === 'DESTINO') {
    return { type: 'mapped', key: 'destination' }
  }
  if (normalized === 'DEPOSITARIO') {
    return { type: 'mapped', key: 'depositary' }
  }
  if (normalized === 'BL' || normalized === 'B/L' || normalized === 'BILL OF LADING') {
    return { type: 'mapped', key: 'billOfLading' }
  }
  if (normalized === 'BOOKING' || normalized === 'NUMERO DE BOOKING') {
    return { type: 'mapped', key: 'bookingNumber' }
  }
  if (
    normalized === 'REDESTINACAO' ||
    normalized === 'REDESTINACAO NUMERO' ||
    normalized === 'NUMERO DE REDESTINACAO'
  ) {
    return { type: 'mapped', key: 'redestinationNumber' }
  }
  if (normalized === 'ARMADOR' || normalized === 'CARRIER') {
    return { type: 'mapped', key: 'carrier' }
  }
  if (normalized === 'CTNR' || normalized === 'CONTAINER' || normalized === 'CONTAINERS') {
    return { type: 'containers' }
  }

  if (normalized === 'NAVIO') {
    return { type: 'unmapped', label: 'NAVIO' }
  }
  if (normalized === 'PREVISAO') {
    return { type: 'unmapped', label: 'PREVISÃO' }
  }
  if (normalized === 'CHEGADA') {
    return { type: 'unmapped', label: 'CHEGADA' }
  }
  if (normalized === 'PROFORMA') {
    return { type: 'unmapped', label: 'PROFORMA' }
  }
  if (normalized === 'INVOICE COMERCIAL') {
    return { type: 'unmapped', label: 'INVOICE COMERCIAL' }
  }
  return { type: 'ignored' }
}

function parseTitleFields(rawTitle: string): ParsedTitleFields {
  const title = normalizeWhitespace(rawTitle)
  if (title.length === 0) {
    return { unmappedFields: [] }
  }

  const segments = title
    .split(TITLE_SEGMENT_SPLIT_REGEX)
    .map((segment) => normalizeWhitespace(segment))
    .filter((segment) => segment.length > 0)

  if (segments.length === 0) return { unmappedFields: [] }

  let reference: string | undefined
  let importerName: string | undefined
  let exporterName: string | undefined
  let product: string | undefined
  const leftovers: string[] = []
  const unmappedFields: ParsedUnmappedField[] = []

  for (const segment of segments) {
    const referenceMatch = segment.match(/^REF\.?(?:\s+[^:]+)?\s*:\s*(.+)$/i)
    if (referenceMatch?.[1]) {
      reference = normalizeWhitespace(referenceMatch[1])
      continue
    }

    const importerMatch = segment.match(/^(?:IMP|IMPORTADOR)\.?\s*:\s*(.+)$/i)
    if (importerMatch?.[1]) {
      importerName = normalizeWhitespace(importerMatch[1])
      continue
    }

    const exporterMatch = segment.match(/^(?:EXP|EXPORTADOR)\.?\s*:\s*(.+)$/i)
    if (exporterMatch?.[1]) {
      exporterName = normalizeWhitespace(exporterMatch[1])
      continue
    }

    const productMatch = segment.match(/^PRODUTO\s*:\s*(.+)$/i)
    if (productMatch?.[1]) {
      const productField = splitProductValueFromInlineVessel(productMatch[1])
      product = productField.productValue

      if (productField.vesselValue !== undefined) {
        unmappedFields.push({ label: 'NAVIO', value: productField.vesselValue })
      }

      continue
    }

    leftovers.push(segment)
  }

  if (!product && leftovers.length > 0) {
    const fallbackProduct = splitProductValueFromInlineVessel(leftovers[leftovers.length - 1] ?? '')
    product = fallbackProduct.productValue

    if (fallbackProduct.vesselValue !== undefined) {
      unmappedFields.push({ label: 'NAVIO', value: fallbackProduct.vesselValue })
    }
  }

  return {
    ...(reference === undefined ? {} : { reference }),
    ...(importerName === undefined ? {} : { importerName }),
    ...(exporterName === undefined ? {} : { exporterName }),
    ...(product === undefined ? {} : { product }),
    unmappedFields,
  }
}

function extractTitleCandidate(lines: readonly string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalizeWhitespace(lines[index] ?? '')
    if (line.length === 0) continue

    const titleLabelMatch = line.match(TITLE_LABEL_REGEX)
    if (!titleLabelMatch) continue

    const inlineTitle = normalizeWhitespace(titleLabelMatch[1] ?? '')
    if (inlineTitle.length > 0) {
      return inlineTitle
    }

    for (let lookAhead = index + 1; lookAhead < lines.length; lookAhead += 1) {
      const nextNonEmpty = normalizeWhitespace(lines[lookAhead] ?? '')
      if (nextNonEmpty.length > 0) return nextNonEmpty
    }
  }

  for (const rawLine of lines) {
    const line = normalizeWhitespace(rawLine)
    if (line.length === 0) continue
    if (/\bREF\.?\b/i.test(line) && (/\bIMP\b/i.test(line) || /\bEXP\b/i.test(line))) {
      return line
    }
  }

  return normalizeWhitespace(lines.find((line) => normalizeWhitespace(line).length > 0) ?? '')
}

function parseLineFields(lines: readonly string[]): ParsedLineFields {
  const scalar: {
    reference?: string
    importerName?: string
    exporterName?: string
    product?: string
    referenceImporter?: string
    redestinationNumber?: string
    origin?: string
    destination?: string
    depositary?: string
    billOfLading?: string
    bookingNumber?: string
    carrier?: string
  } = {}
  const containers: string[] = []
  const unmappedFields: ParsedUnmappedField[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    const labelMatch = line.match(LABEL_LINE_REGEX)
    if (!labelMatch) continue

    const rawLabel = normalizeWhitespace(labelMatch[1] ?? '')
    const rawValue = normalizeWhitespace(labelMatch[2] ?? '')
    if (rawLabel.length === 0) continue

    const classification = toLabelClassification(rawLabel)
    if (classification.type === 'ignored') continue

    if (classification.type === 'containers') {
      containers.push(...extractContainerNumbers(rawValue))
      continue
    }

    if (classification.type === 'unmapped') {
      unmappedFields.push({
        label: classification.label,
        value: rawValue,
      })
      continue
    }

    if (rawValue.length === 0) continue
    if (scalar[classification.key] !== undefined) continue

    if (classification.key === 'product') {
      const productField = splitProductValueFromInlineVessel(rawValue)
      scalar.product = productField.productValue

      if (productField.vesselValue !== undefined) {
        unmappedFields.push({ label: 'NAVIO', value: productField.vesselValue })
      }

      continue
    }

    scalar[classification.key] = rawValue
  }

  return {
    scalar,
    containers: dedupeStrings(containers),
    unmappedFields,
  }
}

function buildWarnings(params: {
  readonly hasCarrier: boolean
  readonly containers: readonly string[]
}): readonly string[] {
  const warnings: string[] = []

  if (!params.hasCarrier) {
    warnings.push('carrier_not_detected')
  }

  if (params.containers.length === 0) {
    warnings.push('no_valid_container_found')
  }

  return dedupeStrings(warnings)
}

export function parseTrelloSmartPaste(rawInput: string): ParsedProcessDraft {
  const normalizedInput = rawInput.replaceAll('\r\n', '\n').replaceAll('\r', '\n')
  const lines = normalizedInput.split('\n')
  const titleCandidate = extractTitleCandidate(lines)
  const titleFields = parseTitleFields(titleCandidate)
  const lineFields = parseLineFields(lines)
  const globalContainers = extractContainerNumbers(normalizedInput)

  const mergedContainers = dedupeStrings([...lineFields.containers, ...globalContainers])
  const reference = titleFields.reference ?? lineFields.scalar.reference
  const importerName = titleFields.importerName ?? lineFields.scalar.importerName
  const exporterName = titleFields.exporterName ?? lineFields.scalar.exporterName
  const product = titleFields.product ?? lineFields.scalar.product

  const fields: ParsedProcessDraft['fields'] = {
    containers: mergedContainers,
    ...(reference === undefined ? {} : { reference }),
    ...(importerName === undefined ? {} : { importerName }),
    ...(exporterName === undefined ? {} : { exporterName }),
    ...(product === undefined ? {} : { product }),
    ...(lineFields.scalar.referenceImporter === undefined
      ? {}
      : { referenceImporter: lineFields.scalar.referenceImporter }),
    ...(lineFields.scalar.redestinationNumber === undefined
      ? {}
      : { redestinationNumber: lineFields.scalar.redestinationNumber }),
    ...(lineFields.scalar.origin === undefined ? {} : { origin: lineFields.scalar.origin }),
    ...(lineFields.scalar.destination === undefined
      ? {}
      : { destination: lineFields.scalar.destination }),
    ...(lineFields.scalar.depositary === undefined
      ? {}
      : { depositary: lineFields.scalar.depositary }),
    ...(lineFields.scalar.billOfLading === undefined
      ? {}
      : { billOfLading: lineFields.scalar.billOfLading }),
    ...(lineFields.scalar.bookingNumber === undefined
      ? {}
      : { bookingNumber: lineFields.scalar.bookingNumber }),
    ...(lineFields.scalar.carrier === undefined ? {} : { carrier: lineFields.scalar.carrier }),
  }

  return {
    fields,
    unmappedFields: [...titleFields.unmappedFields, ...lineFields.unmappedFields],
    warnings: buildWarnings({
      hasCarrier: Boolean(fields.carrier && fields.carrier.trim().length > 0),
      containers: mergedContainers,
    }),
  }
}
