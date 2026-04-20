import type {
  GlobalSearchResponse,
  GlobalSearchSuggestionsResponse,
} from '~/capabilities/search/application/global-search.types'
import type {
  SearchHttpResponseDto,
  SearchSuggestionsHttpResponseDto,
} from '~/capabilities/search/interface/http/search.schemas'

export function toSearchHttpResponseDto(result: GlobalSearchResponse): SearchHttpResponseDto {
  return {
    query: {
      raw: result.query.raw,
      freeTextTerms: result.query.freeTextTerms.map((term) => ({
        rawValue: term.rawValue,
        normalizedValue: term.normalizedValue,
        kind: term.kind,
      })),
      filters: result.query.filters.map((filter) => ({
        key: filter.key,
        rawKey: filter.rawKey,
        rawValue: filter.rawValue,
        normalizedValue: filter.normalizedValue,
        source: filter.source,
        supported: filter.supported,
      })),
      warnings: [...result.query.warnings],
    },
    results: result.results.map((item) => ({
      processId: item.processId,
      processReference: item.processReference,
      billOfLading: item.billOfLading,
      importerName: item.importerName,
      exporterName: item.exporterName,
      carrierName: item.carrierName,
      statusCode: item.statusCode,
      eta: item.eta,
      etaState: item.etaState,
      etaType: item.etaType,
      originLabel: item.originLabel,
      destinationLabel: item.destinationLabel,
      terminalLabel: item.terminalLabel,
      terminalMultiple: item.terminalMultiple,
      depotLabel: item.depotLabel,
      routeLabel: item.routeLabel,
      containerNumbers: [...item.containerNumbers],
      currentLocationLabel: item.currentLocationLabel,
      currentLocationMultiple: item.currentLocationMultiple,
      currentVesselName: item.currentVesselName,
      currentVesselMultiple: item.currentVesselMultiple,
      currentVoyageNumber: item.currentVoyageNumber,
      currentVoyageMultiple: item.currentVoyageMultiple,
      hasValidationRequired: item.hasValidationRequired,
      activeAlertCategories: [...item.activeAlertCategories],
      matchedBy: item.matchedBy.map((match) => ({
        key: match.key,
        source: match.source,
        matchedValue: match.matchedValue,
        rawQueryValue: match.rawQueryValue,
        bucket: match.bucket,
      })),
    })),
    emptyState: {
      titleKey: result.emptyState.titleKey,
      descriptionKey: result.emptyState.descriptionKey,
      examples: [...result.emptyState.examples],
    },
  }
}

export function toSearchSuggestionsHttpResponseDto(
  result: GlobalSearchSuggestionsResponse,
): SearchSuggestionsHttpResponseDto {
  return {
    query: {
      raw: result.query.raw,
      freeTextTerms: result.query.freeTextTerms.map((term) => ({
        rawValue: term.rawValue,
        normalizedValue: term.normalizedValue,
        kind: term.kind,
      })),
      filters: result.query.filters.map((filter) => ({
        key: filter.key,
        rawKey: filter.rawKey,
        rawValue: filter.rawValue,
        normalizedValue: filter.normalizedValue,
        source: filter.source,
        supported: filter.supported,
      })),
      warnings: [...result.query.warnings],
    },
    suggestions: result.suggestions.map((item) => ({
      kind: item.kind,
      fieldKey: item.fieldKey,
      value: item.value,
      labelKey: item.labelKey,
      fallbackLabel: item.fallbackLabel,
      descriptionKey: item.descriptionKey,
      insertText: item.insertText,
    })),
  }
}
