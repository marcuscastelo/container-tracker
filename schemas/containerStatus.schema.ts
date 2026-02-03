/*
  Zod v4 schema para um formato intermediário unificado de acompanhamento de status de containers
  Objetivo: representar eventos e metadados de containers vindos de múltiplas APIs (Maersk, CMA-CGM, MSC, etc.)
  - Normaliza datas em Date (aceita ISO strings, números, e formato "/Date(ms)/")
  - Mantém campos originais quando necessário (campo "sourceEvent" / "raw")
  - Projetado para ser extensível quando criarmos mappings específicos por API

  Uso rápido:
  import { ShipmentSchema } from '../schemas/containerStatus.schema'
  const parsed = ShipmentSchema.parse(payload)

  Autor: gerado por Copilot (GPT-5 mini)
*/

import { z } from 'zod'

// Helper para normalizar várias representações de data usadas nas APIs
const DateLike = z.preprocess((arg: unknown) => {
  if (arg == null || arg === '') return null
  // MS JSON dates like: "/Date(1765887180000)/"
  if (typeof arg === 'string') {
    const msMatch = arg.match(/\/Date\(([-0-9]+)\)\//)
    if (msMatch) {
      const ms = Number(msMatch[1])
      if (!Number.isNaN(ms)) return new Date(ms)
    }
    const d = new Date(arg)
    if (!Number.isNaN(d.getTime())) return d
    return null
  }
  if (typeof arg === 'number') {
    const d = new Date(arg)
    if (!Number.isNaN(d.getTime())) return d
    return null
  }
  if (arg instanceof Date) return arg
  return null
}, z.date().nullable())

// Local/Terminal padronizado
export const LocationSchema = z.object({
  terminal: z.string().nullable().optional(),
  geo_site: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  geoid_city: z.string().nullable().optional(),
  site_type: z.string().nullable().optional(),
  location_code: z.string().nullable().optional(),
  // keep original raw location when mapping from specific API
  raw: z.any().optional(),
})

export type Location = z.infer<typeof LocationSchema>

// Informação de navio/voyage (quando aplicável)
export const VesselSchema = z.object({
  vessel_name: z.string().nullable().optional(),
  voyage_num: z.string().nullable().optional(),
  vessel_num: z.string().nullable().optional(),
  imo: z.string().nullable().optional(),
  built: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  flagName: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export type Vessel = z.infer<typeof VesselSchema>

// Evento padronizado que representa uma mudança de estado / movimentação
export const EventSchema = z.object({
  id: z.string().nullable().optional(),
  // tipo original da fonte (EQUIPMENT, STATUS, etc.)
  eventType: z.string().nullable().optional(),
  // atividade padronizada (LOAD, DISCHARG, GATE-IN, GATE-OUT, etc.)
  activity: z.string().nullable().optional(),
  // flag se é empty/empty-return etc.
  is_empty: z.boolean().nullable().optional(),
  // campo livre da fonte (ex: actfor)
  act_for: z.string().nullable().optional(),
  transport_mode: z.string().nullable().optional(),
  // momento do evento como Date (nullable)
  event_time: DateLike,
  event_time_type: z.string().nullable().optional(), // ACTUAL | EXPECTED etc.
  // local e terminal onde ocorreu
  location: LocationSchema.nullable().optional(),
  // informações do navio/viagem quando aplicável
  vessel: VesselSchema.nullable().optional(),
  // status numérico ou código, quando aplicável
  status_code: z.number().nullable().optional(),
  status_description: z.string().nullable().optional(),
  // detalhes livres (ex: Detail in MSC), ordem (order) para classificar
  detail: z.array(z.string()).nullable().optional(),
  order: z.number().nullable().optional(),
  // mantemos o evento original para referência/mapping
  sourceEvent: z.any().optional(),
})

export type Event = z.infer<typeof EventSchema>

// Local com eventos (utilizado em Maersk-like payloads)
export const LocationWithEventsSchema = LocationSchema.extend({
  events: z.array(EventSchema).optional(),
})

// Container padronizado
export const ContainerSchema = z.object({
  container_number: z.string(),
  container_size: z.union([z.string(), z.number()]).nullable().optional(),
  container_type: z.string().nullable().optional(),
  iso_code: z.string().nullable().optional(),
  operator: z.string().nullable().optional(),
  // locais por onde o container passou (cada um com eventos padronizados)
  locations: z.array(LocationWithEventsSchema).optional(),
  eta_final_delivery: DateLike.optional(),
  // status textual unificado (IN_PROGRESS, DELIVERED, etc.)
  status: z.string().nullable().optional(),
  // status numérico quando disponível (ex: CMA CGM codes)
  status_code: z.number().nullable().optional(),
  last_update_time: DateLike.optional(),
  service_type_origin: z.string().nullable().optional(),
  service_type_destination: z.string().nullable().optional(),
  // raw original payload for this container
  raw: z.any().optional(),
})

export type Container = z.infer<typeof ContainerSchema>

// Shipment / consulta unificada contendo origem, destino, containers e metadados
export const ShipmentSchema = z.object({
  // metadados comuns
  source: z
    .object({
      api: z.string().nullable().optional(), // ex: 'maersk' | 'cmacgm' | 'msc'
      fetched_at: DateLike.optional(),
      raw: z.any().optional(),
    })
    .optional(),
  has_import_shipment: z.boolean().nullable().optional(),
  is_container_search: z.boolean().nullable().optional(),
  is_split_combine_part_load: z.boolean().nullable().optional(),
  is_cancelled_shipment: z.boolean().nullable().optional(),
  unassigned_containers: z.number().nullable().optional(),
  last_update_time: DateLike.optional(),
  origin: LocationSchema.optional(),
  destination: LocationSchema.optional(),
  containers: z.array(ContainerSchema).optional(),
  // keep the original full payload when needed
  raw: z.any().optional(),
})

export type Shipment = z.infer<typeof ShipmentSchema>
// --- Extensões para exibição na UI / summary ---
// ContainerSummary: campos derivados que facilitam renderização da lista
export const ContainerSummarySchema = z.object({
  // identificadores e metadados para exibição
  process_id: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  // BL ou Booking quando disponível
  bl_number: z.string().nullable().optional(),
  booking_number: z.string().nullable().optional(),
  // campos de exibição de rota
  origin_display: z.string().nullable().optional(),
  destination_display: z.string().nullable().optional(),
  route_display: z.string().nullable().optional(),

  // resumo de status usado como badge
  current_status: z.string().nullable().optional(),
  // nível para colorização (info|warning|danger|success)
  status_level: z.enum(['info', 'warning', 'danger', 'success']).nullable().optional(),

  // ETA / progress
  eta: DateLike.optional(),
  eta_display: z.string().nullable().optional(),
  progress_percentage: z.number().nullable().optional(),
  progress_stage: z.string().nullable().optional(),

  // flags rápidos
  is_delayed: z.boolean().nullable().optional(),
  arrival_today: z.boolean().nullable().optional(),

  // último evento resumido
  last_event_time: DateLike.optional(),
  last_event_summary: z.string().nullable().optional(),

  // raw original (se necessário)
  raw: z.any().optional(),
})

export type ContainerSummary = z.infer<typeof ContainerSummarySchema>

// Enriquecer ContainerSchema com поле optional summary e metadata opcionais
export const ContainerSchemaWithSummary = ContainerSchema.extend({
  // campos que podem vir do mapeador para facilitar UI
  process_id: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  bl_number: z.string().nullable().optional(),
  booking_number: z.string().nullable().optional(),
  origin_display: z.string().nullable().optional(),
  destination_display: z.string().nullable().optional(),
  route_display: z.string().nullable().optional(),
  summary: ContainerSummarySchema.optional(),
})

export type ContainerWithSummary = z.infer<typeof ContainerSchemaWithSummary>

export default {
  DateLike,
  LocationSchema,
  VesselSchema,
  EventSchema,
  ContainerSchema,
  ContainerSchemaWithSummary,
  ContainerSummarySchema,
  ShipmentSchema,
}
