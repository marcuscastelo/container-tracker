import type {
  GlobalSearchFilterChipVM,
  GlobalSearchResponseVM,
  GlobalSearchResultItemVM,
  GlobalSearchSuggestionVM,
} from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import type {
  SearchHttpResponseDto,
  SearchSuggestionHttpItemDto,
  SearchSuggestionsHttpResponseDto,
} from '~/capabilities/search/ui/validation/globalSearchApi.validation'
import {
  processStatusToLabelKey,
  toProcessStatusCode,
} from '~/modules/process/ui/mappers/processStatus.ui-mapper'
import type { TranslationApi, TranslationParams } from '~/shared/localization/i18n'
import { formatTemporalDate } from '~/shared/time/temporal-formatters'
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'

function tSafe(
  translation: TranslationApi,
  key: string | null,
  fallback: string,
  params?: TranslationParams,
): string {
  if (key === null) return fallback

  const translated = translation.t(key, params)
  return translated.startsWith('[missing] ') ? fallback : translated
}

const FIELD_LABEL_GETTERS: Readonly<Record<string, (translation: TranslationApi) => string>> = {
  process: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.process),
  process_id: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.process_id),
  container: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.container),
  bl: (translation: TranslationApi) => translation.t(translation.keys.search.filters.fields.bl),
  importer: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.importer),
  exporter: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.exporter),
  carrier: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.carrier),
  vessel: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.vessel),
  voyage: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.voyage),
  status: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.status),
  origin: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.origin),
  origin_country: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.origin_country),
  destination: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.destination),
  destination_country: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.destination_country),
  terminal: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.terminal),
  depot: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.depot),
  route: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.route),
  eta: (translation: TranslationApi) => translation.t(translation.keys.search.filters.fields.eta),
  eta_before: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.eta_before),
  eta_after: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.eta_after),
  eta_month: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.eta_month),
  eta_state: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.eta_state),
  eta_type: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.eta_type),
  current_location: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.current_location),
  current_vessel: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.current_vessel),
  current_voyage: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.current_voyage),
  validation: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.validation),
  alert_category: (translation: TranslationApi) =>
    translation.t(translation.keys.search.filters.fields.alert_category),
}

function fieldLabel(translation: TranslationApi, key: string): string {
  const getter = FIELD_LABEL_GETTERS[key]
  return getter === undefined ? key : getter(translation)
}

function alertCategoryLabel(translation: TranslationApi, value: string): string {
  switch (value) {
    case 'eta':
      return translation.t(translation.keys.search.filters.values.alert_category.eta)
    case 'movement':
      return translation.t(translation.keys.search.filters.values.alert_category.movement)
    case 'customs':
      return translation.t(translation.keys.search.filters.values.alert_category.customs)
    case 'status':
      return translation.t(translation.keys.search.filters.values.alert_category.status)
    case 'data':
      return translation.t(translation.keys.search.filters.values.alert_category.data)
    default:
      return value
  }
}

function etaStateLabel(translation: TranslationApi, value: string): string {
  switch (value) {
    case 'ACTUAL':
      return translation.t(translation.keys.search.filters.values.eta_state.ACTUAL)
    case 'ACTIVE_EXPECTED':
      return translation.t(translation.keys.search.filters.values.eta_state.ACTIVE_EXPECTED)
    case 'EXPIRED_EXPECTED':
      return translation.t(translation.keys.search.filters.values.eta_state.EXPIRED_EXPECTED)
    default:
      return value
  }
}

function etaTypeLabel(translation: TranslationApi, value: string): string {
  switch (value) {
    case 'ARRIVAL':
      return translation.t(translation.keys.search.filters.values.eta_type.ARRIVAL)
    case 'DISCHARGE':
      return translation.t(translation.keys.search.filters.values.eta_type.DISCHARGE)
    case 'DELIVERY':
      return translation.t(translation.keys.search.filters.values.eta_type.DELIVERY)
    default:
      return value
  }
}

function validationLabel(translation: TranslationApi, value: string): string {
  switch (value) {
    case 'required':
      return translation.t(translation.keys.search.filters.values.validation.required)
    case 'clean':
      return translation.t(translation.keys.search.filters.values.validation.clean)
    default:
      return value
  }
}

function matchValueLabel(translation: TranslationApi, key: string, value: string): string {
  if (key === 'status') {
    return translation.t(processStatusToLabelKey(translation.keys, toProcessStatusCode(value)))
  }

  if (key === 'eta_state') {
    return etaStateLabel(translation, value)
  }

  if (key === 'eta_type') {
    return etaTypeLabel(translation, value)
  }

  if (key === 'validation') {
    return validationLabel(translation, value)
  }

  if (key === 'alert_category') {
    return alertCategoryLabel(translation, value)
  }

  return value
}

function toMeta(command: {
  readonly label: string
  readonly value: string | null
}): GlobalSearchResultItemVM['meta'][number] | null {
  if (command.value === null || command.value.trim().length === 0) return null
  return {
    label: command.label,
    value: command.value,
  }
}

function compactMeta(
  items: readonly (GlobalSearchResultItemVM['meta'][number] | null)[],
): readonly GlobalSearchResultItemVM['meta'][number][] {
  return items.filter((item): item is GlobalSearchResultItemVM['meta'][number] => item !== null)
}

function toResultItemVm(
  item: SearchHttpResponseDto['results'][number],
  translation: TranslationApi,
): GlobalSearchResultItemVM {
  const multipleLabel = translation.t(translation.keys.search.multiple)
  const statusLabel =
    item.statusCode === null
      ? null
      : translation.t(
          processStatusToLabelKey(translation.keys, toProcessStatusCode(item.statusCode)),
        )
  const currentLocation =
    item.currentLocationMultiple === true ? multipleLabel : item.currentLocationLabel
  const currentVessel = item.currentVesselMultiple === true ? multipleLabel : item.currentVesselName
  const currentVoyage =
    item.currentVoyageMultiple === true ? multipleLabel : item.currentVoyageNumber
  const terminal = item.terminalMultiple === true ? multipleLabel : item.terminalLabel

  const badges = [
    ...(statusLabel === null ? [] : [statusLabel]),
    ...(item.hasValidationRequired
      ? [translation.t(translation.keys.search.badges.validationRequired)]
      : []),
    ...item.activeAlertCategories.map((value) => alertCategoryLabel(translation, value)),
  ]

  const meta = compactMeta([
    toMeta({
      label: translation.t(translation.keys.search.fields.importerName),
      value: item.importerName,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.exporterName),
      value: item.exporterName,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.carrier),
      value: toCarrierDisplayLabel(item.carrierName),
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.bl),
      value: item.billOfLading,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.containers),
      value: item.containerNumbers.length > 0 ? item.containerNumbers.join(', ') : null,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.eta),
      value: item.eta === null ? null : formatTemporalDate(item.eta, translation.locale(), 'UTC'),
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.currentLocation),
      value: currentLocation,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.currentVessel),
      value: currentVessel,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.currentVoyage),
      value: currentVoyage,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.route),
      value: item.routeLabel,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.origin),
      value: item.originLabel,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.destination),
      value: item.destinationLabel,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.terminal),
      value: terminal,
    }),
    toMeta({
      label: translation.t(translation.keys.search.fields.depot),
      value: item.depotLabel,
    }),
  ])

  return {
    processId: item.processId,
    title:
      item.processReference ??
      item.billOfLading ??
      item.containerNumbers[0] ??
      `${translation.t(translation.keys.search.fields.processId)}: ${item.processId}`,
    supportingId: `${translation.t(translation.keys.search.fields.processId)}: ${item.processId}`,
    matchSummary: item.matchedBy.map(
      (match) =>
        `${fieldLabel(translation, match.key)}: ${matchValueLabel(translation, match.key, match.matchedValue)}`,
    ),
    badges,
    meta,
  }
}

export function toGlobalSearchResponseVm(
  response: SearchHttpResponseDto,
  translation: TranslationApi,
): GlobalSearchResponseVM {
  return {
    items: response.results.map((item) => toResultItemVm(item, translation)),
    emptyTitle: tSafe(translation, response.emptyState.titleKey, response.emptyState.titleKey),
    emptyDescription: tSafe(
      translation,
      response.emptyState.descriptionKey,
      response.emptyState.descriptionKey,
    ),
    emptyExamples: [...response.emptyState.examples],
  }
}

function toSuggestionVm(
  item: SearchSuggestionHttpItemDto,
  translation: TranslationApi,
): GlobalSearchSuggestionVM {
  return {
    kind: item.kind,
    fieldKey: item.fieldKey,
    value: item.value,
    label: tSafe(translation, item.labelKey, item.fallbackLabel),
    description:
      item.descriptionKey === null
        ? null
        : tSafe(translation, item.descriptionKey, item.descriptionKey),
    insertText: item.insertText,
  }
}

export function toGlobalSearchSuggestionsVm(
  response: SearchSuggestionsHttpResponseDto,
  translation: TranslationApi,
): readonly GlobalSearchSuggestionVM[] {
  return response.suggestions.map((item) => toSuggestionVm(item, translation))
}

export function toGlobalSearchFilterChipVm(
  translation: TranslationApi,
  key: string,
  value: string,
): GlobalSearchFilterChipVM {
  return {
    key,
    value,
    label: `${fieldLabel(translation, key)}: ${matchValueLabel(translation, key, value)}`,
  }
}
