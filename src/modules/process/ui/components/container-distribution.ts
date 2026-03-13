/**
 * Container distribution helper functions used by the ContainerSelector UI.
 * Kept in a separate file to allow unit testing without importing UI/client-only
 * dependencies.
 */

/**
 * Maximum items per row used by the distribution algorithm.
 */
export const MAX_PER_ROW = 4

/**
 * Computes how many items to place in each row given a total count.
 *
 * Rules (max MAX_PER_ROW per row):
 *   rows = ceil(n / MAX_PER_ROW)
 *   base = floor(n / rows)
 *   The first (n % rows) rows get (base + 1) items; the rest get base.
 */
export function computeRowDistribution(n: number): number[] {
  if (n <= 0) return []
  const rowCount = Math.ceil(n / MAX_PER_ROW)
  const base = Math.floor(n / rowCount)
  const remainder = n % rowCount
  return Array.from({ length: rowCount }, (_, i) => (i < remainder ? base + 1 : base))
}
