import type {
  GlobalSearchFilterKey,
  SupportedGlobalSearchFilterKey,
} from '~/capabilities/search/application/global-search.types'

export type GlobalSearchFieldKind = 'identifier' | 'text' | 'enum' | 'date'

export type GlobalSearchEnumOption = Readonly<{
  value: string
  labelKey: string
  fallbackLabel: string
  aliases: readonly string[]
}>

export type GlobalSearchFieldDefinition = Readonly<{
  key: GlobalSearchFilterKey
  kind: GlobalSearchFieldKind
  labelKey: string
  fallbackLabel: string
  aliases: readonly string[]
  enumOptions?: readonly GlobalSearchEnumOption[]
  suggestionExamples?: readonly string[]
  supported: boolean
}>

function normalizeAlias(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

const STATUS_OPTIONS = [
  {
    value: 'BOOKED',
    labelKey: 'tracking.status.BOOKED',
    fallbackLabel: 'Reservado',
    aliases: ['booked', 'reservado'],
  },
  {
    value: 'AWAITING_DATA',
    labelKey: 'tracking.status.AWAITING_DATA',
    fallbackLabel: 'Aguardando dados',
    aliases: ['awaiting_data', 'awaiting data', 'aguardando dados'],
  },
  {
    value: 'NOT_SYNCED',
    labelKey: 'tracking.status.NOT_SYNCED',
    fallbackLabel: 'Não sincronizado',
    aliases: ['not_synced', 'not synced', 'nao sincronizado', 'não sincronizado'],
  },
  {
    value: 'IN_PROGRESS',
    labelKey: 'tracking.status.IN_PROGRESS',
    fallbackLabel: 'Em progresso',
    aliases: ['in_progress', 'in progress', 'em progresso'],
  },
  {
    value: 'LOADED',
    labelKey: 'tracking.status.LOADED',
    fallbackLabel: 'Carregado',
    aliases: ['loaded', 'carregado'],
  },
  {
    value: 'IN_TRANSIT',
    labelKey: 'tracking.status.IN_TRANSIT',
    fallbackLabel: 'Em trânsito',
    aliases: ['in_transit', 'in transit', 'em transito', 'em trânsito'],
  },
  {
    value: 'ARRIVED_AT_POD',
    labelKey: 'tracking.status.ARRIVED_AT_POD',
    fallbackLabel: 'Chegou ao POD',
    aliases: ['arrived_at_pod', 'arrived at pod', 'chegou ao pod'],
  },
  {
    value: 'DISCHARGED',
    labelKey: 'tracking.status.DISCHARGED',
    fallbackLabel: 'Descarregado',
    aliases: ['discharged', 'descarregado'],
  },
  {
    value: 'AVAILABLE_FOR_PICKUP',
    labelKey: 'tracking.status.AVAILABLE_FOR_PICKUP',
    fallbackLabel: 'Disponível para retirada',
    aliases: [
      'available_for_pickup',
      'available for pickup',
      'disponivel para retirada',
      'disponível para retirada',
    ],
  },
  {
    value: 'DELIVERED',
    labelKey: 'tracking.status.DELIVERED',
    fallbackLabel: 'Entregue',
    aliases: ['delivered', 'entregue'],
  },
  {
    value: 'EMPTY_RETURNED',
    labelKey: 'tracking.status.EMPTY_RETURNED',
    fallbackLabel: 'Vazio devolvido',
    aliases: ['empty_returned', 'empty returned', 'vazio devolvido'],
  },
  {
    value: 'UNKNOWN',
    labelKey: 'tracking.status.UNKNOWN',
    fallbackLabel: 'Desconhecido',
    aliases: ['unknown', 'desconhecido'],
  },
] as const satisfies readonly GlobalSearchEnumOption[]

const ETA_STATE_OPTIONS = [
  {
    value: 'ACTUAL',
    labelKey: 'search.filters.values.eta_state.ACTUAL',
    fallbackLabel: 'ETA atual',
    aliases: ['actual', 'atual'],
  },
  {
    value: 'ACTIVE_EXPECTED',
    labelKey: 'search.filters.values.eta_state.ACTIVE_EXPECTED',
    fallbackLabel: 'ETA ativo',
    aliases: ['active_expected', 'active expected', 'eta ativo', 'ativo'],
  },
  {
    value: 'EXPIRED_EXPECTED',
    labelKey: 'search.filters.values.eta_state.EXPIRED_EXPECTED',
    fallbackLabel: 'ETA expirado',
    aliases: ['expired_expected', 'expired expected', 'eta expirado', 'expirado'],
  },
] as const satisfies readonly GlobalSearchEnumOption[]

const ETA_TYPE_OPTIONS = [
  {
    value: 'ARRIVAL',
    labelKey: 'search.filters.values.eta_type.ARRIVAL',
    fallbackLabel: 'Chegada',
    aliases: ['arrival', 'chegada'],
  },
  {
    value: 'DISCHARGE',
    labelKey: 'search.filters.values.eta_type.DISCHARGE',
    fallbackLabel: 'Descarga',
    aliases: ['discharge', 'descarga', 'descarregamento'],
  },
  {
    value: 'DELIVERY',
    labelKey: 'search.filters.values.eta_type.DELIVERY',
    fallbackLabel: 'Entrega',
    aliases: ['delivery', 'entrega'],
  },
] as const satisfies readonly GlobalSearchEnumOption[]

const VALIDATION_OPTIONS = [
  {
    value: 'required',
    labelKey: 'search.filters.values.validation.required',
    fallbackLabel: 'Validação necessária',
    aliases: [
      'required',
      'validation_required',
      'validation required',
      'validacao necessaria',
      'validação necessária',
    ],
  },
  {
    value: 'clean',
    labelKey: 'search.filters.values.validation.clean',
    fallbackLabel: 'Sem validação pendente',
    aliases: ['clean', 'ok', 'none', 'sem validacao', 'sem validação'],
  },
] as const satisfies readonly GlobalSearchEnumOption[]

const ALERT_CATEGORY_OPTIONS = [
  {
    value: 'eta',
    labelKey: 'search.filters.values.alert_category.eta',
    fallbackLabel: 'Alerta de ETA',
    aliases: ['eta'],
  },
  {
    value: 'movement',
    labelKey: 'search.filters.values.alert_category.movement',
    fallbackLabel: 'Alerta de movimentação',
    aliases: ['movement', 'movimento', 'movimentacao', 'movimentação'],
  },
  {
    value: 'customs',
    labelKey: 'search.filters.values.alert_category.customs',
    fallbackLabel: 'Alerta aduaneiro',
    aliases: ['customs', 'aduana', 'alfandega', 'alfândega'],
  },
  {
    value: 'status',
    labelKey: 'search.filters.values.alert_category.status',
    fallbackLabel: 'Alerta de status',
    aliases: ['status'],
  },
  {
    value: 'data',
    labelKey: 'search.filters.values.alert_category.data',
    fallbackLabel: 'Alerta de dados',
    aliases: ['data', 'dados'],
  },
] as const satisfies readonly GlobalSearchEnumOption[]

const FIELD_DEFINITIONS = [
  {
    key: 'process',
    kind: 'identifier',
    labelKey: 'search.filters.fields.process',
    fallbackLabel: 'Processo',
    aliases: ['process', 'ref', 'reference'],
    suggestionExamples: ['process:CA048-26'],
    supported: true,
  },
  {
    key: 'process_id',
    kind: 'identifier',
    labelKey: 'search.filters.fields.process_id',
    fallbackLabel: 'ID do processo',
    aliases: ['process_id', 'process-id', 'id'],
    suggestionExamples: ['process_id:7aae3129-c88a-45a2-aa9e-f2fbecb26bd7'],
    supported: true,
  },
  {
    key: 'container',
    kind: 'identifier',
    labelKey: 'search.filters.fields.container',
    fallbackLabel: 'Container',
    aliases: ['container', 'cntr'],
    suggestionExamples: ['container:MSKU1234567'],
    supported: true,
  },
  {
    key: 'bl',
    kind: 'identifier',
    labelKey: 'search.filters.fields.bl',
    fallbackLabel: 'BL',
    aliases: ['bl'],
    suggestionExamples: ['bl:MEDUP6124762'],
    supported: true,
  },
  {
    key: 'importer',
    kind: 'text',
    labelKey: 'search.filters.fields.importer',
    fallbackLabel: 'Importador',
    aliases: ['importer', 'importador'],
    suggestionExamples: ['importer:Flush'],
    supported: true,
  },
  {
    key: 'exporter',
    kind: 'text',
    labelKey: 'search.filters.fields.exporter',
    fallbackLabel: 'Exportador',
    aliases: ['exporter', 'exportador'],
    suggestionExamples: ['exporter:Acme'],
    supported: true,
  },
  {
    key: 'carrier',
    kind: 'text',
    labelKey: 'search.filters.fields.carrier',
    fallbackLabel: 'Armador',
    aliases: ['carrier', 'armador'],
    suggestionExamples: ['carrier:MSC'],
    supported: true,
  },
  {
    key: 'vessel',
    kind: 'text',
    labelKey: 'search.filters.fields.vessel',
    fallbackLabel: 'Navio',
    aliases: ['vessel', 'navio'],
    suggestionExamples: ['vessel:Maersk'],
    supported: true,
  },
  {
    key: 'voyage',
    kind: 'text',
    labelKey: 'search.filters.fields.voyage',
    fallbackLabel: 'Viagem',
    aliases: ['voyage', 'viagem'],
    suggestionExamples: ['voyage:123E'],
    supported: true,
  },
  {
    key: 'status',
    kind: 'enum',
    labelKey: 'search.filters.fields.status',
    fallbackLabel: 'Status',
    aliases: ['status', 'status_code'],
    enumOptions: STATUS_OPTIONS,
    suggestionExamples: ['status:DELIVERED'],
    supported: true,
  },
  {
    key: 'origin',
    kind: 'text',
    labelKey: 'search.filters.fields.origin',
    fallbackLabel: 'Origem',
    aliases: ['origin', 'origem'],
    suggestionExamples: ['origin:Santos'],
    supported: true,
  },
  {
    key: 'origin_country',
    kind: 'text',
    labelKey: 'search.filters.fields.origin_country',
    fallbackLabel: 'País de origem',
    aliases: ['origin_country', 'origin-country'],
    suggestionExamples: ['origin_country:brazil'],
    supported: true,
  },
  {
    key: 'destination',
    kind: 'text',
    labelKey: 'search.filters.fields.destination',
    fallbackLabel: 'Destino',
    aliases: ['destination', 'destino'],
    suggestionExamples: ['destination:Karachi'],
    supported: true,
  },
  {
    key: 'destination_country',
    kind: 'text',
    labelKey: 'search.filters.fields.destination_country',
    fallbackLabel: 'País de destino',
    aliases: ['destination_country', 'destination-country', 'country', 'pais', 'país'],
    suggestionExamples: ['destination_country:pakistan'],
    supported: true,
  },
  {
    key: 'terminal',
    kind: 'text',
    labelKey: 'search.filters.fields.terminal',
    fallbackLabel: 'Terminal',
    aliases: ['terminal'],
    suggestionExamples: ['terminal:Movecta'],
    supported: true,
  },
  {
    key: 'depot',
    kind: 'text',
    labelKey: 'search.filters.fields.depot',
    fallbackLabel: 'Depositário',
    aliases: ['depot', 'depositary', 'depositario', 'depositário'],
    suggestionExamples: ['depot:Movecta'],
    supported: true,
  },
  {
    key: 'route',
    kind: 'text',
    labelKey: 'search.filters.fields.route',
    fallbackLabel: 'Rota',
    aliases: ['route', 'rota'],
    suggestionExamples: ['route:Santos'],
    supported: true,
  },
  {
    key: 'eta',
    kind: 'date',
    labelKey: 'search.filters.fields.eta',
    fallbackLabel: 'ETA',
    aliases: ['eta'],
    suggestionExamples: ['eta:06/05/2026', 'eta:06/05'],
    supported: true,
  },
  {
    key: 'eta_before',
    kind: 'date',
    labelKey: 'search.filters.fields.eta_before',
    fallbackLabel: 'ETA antes de',
    aliases: ['eta_before', 'eta-before'],
    suggestionExamples: ['eta_before:10/05/2026'],
    supported: true,
  },
  {
    key: 'eta_after',
    kind: 'date',
    labelKey: 'search.filters.fields.eta_after',
    fallbackLabel: 'ETA depois de',
    aliases: ['eta_after', 'eta-after'],
    suggestionExamples: ['eta_after:01/05/2026'],
    supported: true,
  },
  {
    key: 'eta_month',
    kind: 'date',
    labelKey: 'search.filters.fields.eta_month',
    fallbackLabel: 'ETA no mês',
    aliases: ['eta_month', 'eta-month'],
    suggestionExamples: ['eta_month:05/2026'],
    supported: true,
  },
  {
    key: 'eta_state',
    kind: 'enum',
    labelKey: 'search.filters.fields.eta_state',
    fallbackLabel: 'Estado do ETA',
    aliases: ['eta_state', 'eta-state'],
    enumOptions: ETA_STATE_OPTIONS,
    suggestionExamples: ['eta_state:ACTIVE_EXPECTED'],
    supported: true,
  },
  {
    key: 'eta_type',
    kind: 'enum',
    labelKey: 'search.filters.fields.eta_type',
    fallbackLabel: 'Tipo de ETA',
    aliases: ['eta_type', 'eta-type'],
    enumOptions: ETA_TYPE_OPTIONS,
    suggestionExamples: ['eta_type:ARRIVAL'],
    supported: true,
  },
  {
    key: 'current_location',
    kind: 'text',
    labelKey: 'search.filters.fields.current_location',
    fallbackLabel: 'Localização atual',
    aliases: [
      'current_location',
      'current-location',
      'location',
      'localizacao_atual',
      'localização_atual',
    ],
    suggestionExamples: ['current_location:Santos'],
    supported: true,
  },
  {
    key: 'current_vessel',
    kind: 'text',
    labelKey: 'search.filters.fields.current_vessel',
    fallbackLabel: 'Navio atual',
    aliases: ['current_vessel', 'current-vessel'],
    suggestionExamples: ['current_vessel:Maersk'],
    supported: true,
  },
  {
    key: 'current_voyage',
    kind: 'text',
    labelKey: 'search.filters.fields.current_voyage',
    fallbackLabel: 'Viagem atual',
    aliases: ['current_voyage', 'current-voyage'],
    suggestionExamples: ['current_voyage:123E'],
    supported: true,
  },
  {
    key: 'validation',
    kind: 'enum',
    labelKey: 'search.filters.fields.validation',
    fallbackLabel: 'Validação',
    aliases: ['validation', 'has_validation_required'],
    enumOptions: VALIDATION_OPTIONS,
    suggestionExamples: ['validation:required'],
    supported: true,
  },
  {
    key: 'alert_category',
    kind: 'enum',
    labelKey: 'search.filters.fields.alert_category',
    fallbackLabel: 'Categoria de alerta',
    aliases: ['alert_category', 'alert-category', 'active_alert_categories'],
    enumOptions: ALERT_CATEGORY_OPTIONS,
    suggestionExamples: ['alert_category:eta'],
    supported: true,
  },
  {
    key: 'event_date',
    kind: 'date',
    labelKey: 'search.filters.fields.event_date',
    fallbackLabel: 'Data do evento',
    aliases: ['event_date', 'event-date'],
    suggestionExamples: ['event_date:06/05/2026'],
    supported: false,
  },
] as const satisfies readonly GlobalSearchFieldDefinition[]

const DEFINITION_BY_KEY = new Map(FIELD_DEFINITIONS.map((field) => [field.key, field] as const))

const FIELD_KEY_BY_ALIAS = new Map<string, GlobalSearchFilterKey>()
for (const field of FIELD_DEFINITIONS) {
  FIELD_KEY_BY_ALIAS.set(normalizeAlias(field.key), field.key)

  for (const alias of field.aliases) {
    FIELD_KEY_BY_ALIAS.set(normalizeAlias(alias), field.key)
  }
}

export function normalizeSearchAlias(value: string): string {
  return normalizeAlias(value)
}

export function resolveGlobalSearchFieldAlias(value: string): GlobalSearchFilterKey | null {
  return FIELD_KEY_BY_ALIAS.get(normalizeAlias(value)) ?? null
}

export function getGlobalSearchFieldDefinition(
  key: GlobalSearchFilterKey,
): GlobalSearchFieldDefinition | null {
  return DEFINITION_BY_KEY.get(key) ?? null
}

export function listSupportedGlobalSearchFields(): readonly GlobalSearchFieldDefinition[] {
  return FIELD_DEFINITIONS.filter((field) => field.supported)
}

export function getSupportedGlobalSearchFieldDefinition(
  key: SupportedGlobalSearchFilterKey,
): GlobalSearchFieldDefinition {
  const definition = DEFINITION_BY_KEY.get(key)
  if (definition === undefined || !definition.supported) {
    throw new Error(`Unsupported global search field: ${key}`)
  }

  return definition
}

export function resolveEnumOptionForField(
  key: SupportedGlobalSearchFilterKey,
  rawValue: string,
): GlobalSearchEnumOption | null {
  const definition = getSupportedGlobalSearchFieldDefinition(key)
  const options = definition.enumOptions
  if (options === undefined) return null

  const normalizedValue = normalizeAlias(rawValue)

  return (
    options.find((option) => {
      if (normalizeAlias(option.value) === normalizedValue) return true
      return option.aliases.some((alias) => normalizeAlias(alias) === normalizedValue)
    }) ?? null
  )
}

export function listEnumOptionsForField(
  key: SupportedGlobalSearchFilterKey,
): readonly GlobalSearchEnumOption[] {
  return getSupportedGlobalSearchFieldDefinition(key).enumOptions ?? []
}
