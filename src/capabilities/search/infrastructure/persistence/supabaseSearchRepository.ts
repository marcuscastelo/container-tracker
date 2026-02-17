// src/modules/search/infrastructure/persistence/supabaseSearchRepository.ts
//
// Supabase-backed implementation of the SearchRepository port.
// Queries processes + containers tables with ILIKE for MVP ranking.

import type { SearchRepository } from '~/capabilities/search/application/search.repository'
import type {
  SearchResultItemProjection,
  SearchResultType,
} from '~/capabilities/search/application/search.types'
import type { Json } from '~/shared/supabase/database.types'
import { supabase } from '~/shared/supabase/supabase'

/**
 * Raw row shape returned from the processes table query.
 * We only select the columns we need — never full rows.
 * origin/destination are stored as Json in Supabase.
 */
type ProcessSearchRow = {
  id: string
  reference: string | null
  carrier: string | null
  bill_of_lading: string | null
  booking_number: string | null
  importer_name: string | null
  exporter_name: string | null
  reference_importer: string | null
  product: string | null
  redestination_number: string | null
  origin: Json
  destination: Json
}

type ContainerSearchRow = {
  id: string
  container_number: string
  carrier_code: string
  process_id: string
}

// ---------------------------------------------------------------------------
// Helpers: scoring & deduplication
// ---------------------------------------------------------------------------

function scoreMatch(value: string, query: string): number {
  const lower = value.toLowerCase()
  const q = query.toLowerCase()
  if (lower === q) return 4 // exact
  if (lower.startsWith(q)) return 3 // prefix
  if (lower.includes(q)) return 2 // contains
  return 0
}

function bestScore(values: readonly (string | null | undefined)[], query: string): number {
  let best = 0
  for (const v of values) {
    if (v) {
      const s = scoreMatch(v, query)
      if (s > best) best = s
    }
  }
  return best
}

function originDisplay(origin: Json): string | null {
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) return null
  const rec = origin
  if ('display_name' in rec && typeof rec.display_name === 'string') {
    return rec.display_name
  }
  return null
}

// ---------------------------------------------------------------------------
// Process → SearchResultItemProjection mappers
// ---------------------------------------------------------------------------

function processToProjections(row: ProcessSearchRow, query: string): SearchResultItemProjection[] {
  const results: SearchResultItemProjection[] = []

  // --- Process-level match ---
  const processFields = [
    row.reference,
    row.bill_of_lading,
    row.booking_number,
    row.reference_importer,
    row.product,
    row.redestination_number,
    originDisplay(row.origin),
    originDisplay(row.destination),
    row.id,
  ]
  const pScore = bestScore(processFields, query)
  if (pScore > 0) {
    const subtitle = [
      row.bill_of_lading ? `BL: ${row.bill_of_lading}` : null,
      originDisplay(row.origin),
      originDisplay(row.destination),
    ]
      .filter(Boolean)
      .join(' · ')

    results.push({
      id: row.id,
      type: 'process',
      title: row.reference ?? row.id.slice(0, 8),
      subtitle: subtitle || null,
      processId: row.id,
      status: null,
      carrier: row.carrier,
    })
  }

  // --- Importer match ---
  if (row.importer_name && scoreMatch(row.importer_name, query) > 0) {
    results.push({
      id: `imp-${row.id}`,
      type: 'importer',
      title: row.importer_name,
      subtitle: row.reference ?? row.id.slice(0, 8),
      processId: row.id,
      status: null,
      carrier: row.carrier,
    })
  }

  // --- Exporter match ---
  if (row.exporter_name && scoreMatch(row.exporter_name, query) > 0) {
    results.push({
      id: `exp-${row.id}`,
      type: 'exporter',
      title: row.exporter_name,
      subtitle: row.reference ?? row.id.slice(0, 8),
      processId: row.id,
      status: null,
      carrier: row.carrier,
    })
  }

  // --- Carrier match ---
  if (row.carrier && scoreMatch(row.carrier, query) > 0) {
    results.push({
      id: `carrier-${row.id}`,
      type: 'carrier',
      title: row.carrier,
      subtitle: row.reference ?? row.id.slice(0, 8),
      processId: row.id,
      status: null,
      carrier: row.carrier,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export const supabaseSearchRepository: SearchRepository = {
  async search(query: string, limit: number): Promise<readonly SearchResultItemProjection[]> {
    const pattern = `%${query}%`

    // --- 1. Query processes table ---
    const processResult = await supabase
      .from('processes')
      .select(
        'id, reference, carrier, bill_of_lading, booking_number, importer_name, exporter_name, reference_importer, product, redestination_number, origin, destination',
      )
      .or(
        [
          `reference.ilike.${pattern}`,
          `bill_of_lading.ilike.${pattern}`,
          `booking_number.ilike.${pattern}`,
          `importer_name.ilike.${pattern}`,
          `exporter_name.ilike.${pattern}`,
          `reference_importer.ilike.${pattern}`,
          `product.ilike.${pattern}`,
          `redestination_number.ilike.${pattern}`,
          `carrier.ilike.${pattern}`,
          `id.ilike.${pattern}`,
        ].join(','),
      )
      .is('deleted_at', null)
      .limit(limit)

    const processRows: ProcessSearchRow[] = processResult.data ?? []

    // --- 2. Query containers table ---
    const containerResult = await supabase
      .from('containers')
      .select('id, container_number, carrier_code, process_id')
      .ilike('container_number', pattern)
      .is('removed_at', null)
      .limit(limit)

    const containerRows: ContainerSearchRow[] = containerResult.data ?? []

    // --- 3. Map and score ---
    type ScoredItem = { item: SearchResultItemProjection; score: number }

    const scored: ScoredItem[] = []

    // Process-based results
    for (const row of processRows) {
      const projections = processToProjections(row, query)
      for (const item of projections) {
        const s = bestScore([item.title, item.subtitle], query)
        scored.push({ item, score: s })
      }
    }

    // Container results
    for (const row of containerRows) {
      const s = scoreMatch(row.container_number, query)
      scored.push({
        item: {
          id: row.id,
          type: 'container',
          title: row.container_number,
          subtitle: null,
          processId: row.process_id,
          status: null,
          carrier: row.carrier_code,
        },
        score: s,
      })
    }

    // --- 4. Deduplicate by id ---
    const seen = new Set<string>()
    const unique: ScoredItem[] = []
    for (const entry of scored) {
      if (!seen.has(entry.item.id)) {
        seen.add(entry.item.id)
        unique.push(entry)
      }
    }

    // --- 5. Sort by score (desc), then by type priority ---
    const typePriority: Record<SearchResultType, number> = {
      container: 0,
      process: 1,
      importer: 2,
      exporter: 3,
      carrier: 4,
    }

    unique.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (typePriority[a.item.type] ?? 5) - (typePriority[b.item.type] ?? 5)
    })

    return unique.slice(0, limit).map((s) => s.item)
  },
}
