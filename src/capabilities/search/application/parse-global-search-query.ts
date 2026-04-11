import {
  getGlobalSearchFieldDefinition,
  normalizeSearchAlias,
  resolveGlobalSearchFieldAlias,
} from '~/capabilities/search/application/global-search.fields'
import type {
  GlobalSearchFilterSource,
  GlobalSearchFreeTextTerm,
  ParsedGlobalSearchFilter,
  ParsedGlobalSearchQuery,
} from '~/capabilities/search/application/global-search.types'

type ParseGlobalSearchQueryCommand = Readonly<{
  query: string
  filters: readonly string[]
}>

const DD_MM_PATTERN = /^\d{1,2}\/\d{1,2}$/
const DD_MM_YYYY_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/

function normalizeWhitespace(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ')
}

function normalizeText(value: string): string {
  return normalizeSearchAlias(value)
}

function parseFreeTextTerm(token: string): GlobalSearchFreeTextTerm {
  const normalizedValue = normalizeText(token)

  if (DD_MM_YYYY_PATTERN.test(token)) {
    return { rawValue: token, normalizedValue, kind: 'date-full' }
  }

  if (DD_MM_PATTERN.test(token)) {
    return { rawValue: token, normalizedValue, kind: 'date-day-month' }
  }

  return { rawValue: token, normalizedValue, kind: 'text' }
}

function parseStructuredToken(
  token: string,
  source: GlobalSearchFilterSource,
): ParsedGlobalSearchFilter | null {
  const separatorIndex = token.indexOf(':')
  if (separatorIndex <= 0) return null

  const rawKey = token.slice(0, separatorIndex).trim()
  const rawValue = token.slice(separatorIndex + 1).trim()
  if (rawKey.length === 0 || rawValue.length === 0) return null

  const key = resolveGlobalSearchFieldAlias(rawKey)
  if (key === null) return null

  const definition = getGlobalSearchFieldDefinition(key)
  if (definition === null) return null

  return {
    key,
    rawKey,
    rawValue,
    normalizedValue: normalizeText(rawValue),
    source,
    supported: definition.supported,
  }
}

function parseDraftTokens(command: {
  readonly query: string
  readonly warnings: string[]
  readonly terms: GlobalSearchFreeTextTerm[]
  readonly filters: ParsedGlobalSearchFilter[]
}): void {
  const normalizedQuery = normalizeWhitespace(command.query)
  if (normalizedQuery.length === 0) return

  for (const token of normalizedQuery.split(' ')) {
    const filter = parseStructuredToken(token, 'draft')
    if (filter !== null) {
      if (!filter.supported) {
        command.warnings.push(`Unsupported filter reserved for future use: ${filter.rawKey}`)
      }
      command.filters.push(filter)
      continue
    }

    if (token.includes(':')) {
      const [rawKey] = token.split(':')
      if (rawKey !== undefined && resolveGlobalSearchFieldAlias(rawKey) !== null) {
        command.warnings.push(`Incomplete filter ignored: ${token}`)
        continue
      }
    }

    command.terms.push(parseFreeTextTerm(token))
  }
}

function parseChipFilters(command: {
  readonly rawFilters: readonly string[]
  readonly warnings: string[]
  readonly filters: ParsedGlobalSearchFilter[]
}): void {
  for (const rawFilter of command.rawFilters) {
    const normalizedFilter = normalizeWhitespace(rawFilter)
    if (normalizedFilter.length === 0) continue

    const parsed = parseStructuredToken(normalizedFilter, 'chip')
    if (parsed !== null) {
      if (!parsed.supported) {
        command.warnings.push(`Unsupported filter reserved for future use: ${parsed.rawKey}`)
      }
      command.filters.push(parsed)
      continue
    }

    command.warnings.push(`Invalid filter ignored: ${rawFilter}`)
  }
}

function dedupeFilters(filters: readonly ParsedGlobalSearchFilter[], warnings: string[]) {
  const lastIndexByKey = new Map<string, number>()
  const occurrencesByKey = new Map<string, number>()

  filters.forEach((filter, index) => {
    lastIndexByKey.set(filter.key, index)
    const currentOccurrences = occurrencesByKey.get(filter.key) ?? 0
    occurrencesByKey.set(filter.key, currentOccurrences + 1)
  })

  for (const [key, count] of occurrencesByKey) {
    if (count > 1) {
      warnings.push(`Duplicate filter overridden by the last value: ${key}`)
    }
  }

  return filters.filter((filter, index) => lastIndexByKey.get(filter.key) === index)
}

export function parseGlobalSearchQuery(
  command: ParseGlobalSearchQueryCommand,
): ParsedGlobalSearchQuery {
  const warnings: string[] = []
  const freeTextTerms: GlobalSearchFreeTextTerm[] = []
  const filters: ParsedGlobalSearchFilter[] = []

  parseChipFilters({
    rawFilters: command.filters,
    warnings,
    filters,
  })
  parseDraftTokens({
    query: command.query,
    warnings,
    terms: freeTextTerms,
    filters,
  })

  return {
    raw: [command.query.trim(), ...command.filters.map((filter) => filter.trim())]
      .filter((value) => value.length > 0)
      .join(' '),
    freeTextTerms,
    filters: dedupeFilters(filters, warnings),
    warnings,
  }
}
