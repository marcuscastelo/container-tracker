import { supabase } from '~/shared/supabase/supabase'

/**
 * Helper to access Supabase tables that don't yet exist in `database.types.ts`.
 *
 * These tables will be created via migration. Once the types are regenerated
 * (e.g. via `supabase gen types`), replace usages of this helper with
 * direct `supabase.from('table_name')` calls and delete this file.
 *
 * Tables that use this helper:
 *   - container_snapshots
 *   - container_observations
 *   - tracking_alerts
 *
 * Safety: All data returned from these queries is validated through Zod safeParse
 * in the respective repository modules, so there is no loss of runtime safety.
 */

/**
 * Access a Supabase table by name, bypassing compile-time table validation.
 *
 * @param table - The PostgreSQL table name (e.g. 'container_snapshots')
 * @returns A PostgREST query builder (untyped — validated via Zod downstream)
 */
// biome-ignore lint/suspicious/noExplicitAny: Temporary — tables not yet in database.types.ts. Data is Zod-validated downstream. Delete this file after migration.
export function fromUntypedTable(table: string): any {
  // @ts-expect-error — Table does not exist in database.types.ts yet. Will be created via migration.
  return supabase.from(table)
}
