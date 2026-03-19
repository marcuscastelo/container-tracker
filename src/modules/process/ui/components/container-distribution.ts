/**
 * Container distribution helper functions used by the ContainerSelector UI.
 * Kept in a separate file to allow unit testing without importing UI/client-only
 * dependencies.
 */

/**
 * Computes how many items to place in each row given a total count
 * and a caller-provided max items per row.
 *
 * Rules:
 *   rows = ceil(n / maxPerRow)
 *   base = floor(n / rows)
 *   The first (n % rows) rows get (base + 1) items; the rest get base.
 */
export function computeRowDistribution(n: number, maxPerRow: number): number[] {
  if (n <= 0) return []
  if (maxPerRow <= 0) return []

  const rowCount = Math.ceil(n / maxPerRow)
  const base = Math.floor(n / rowCount)
  const remainder = n % rowCount

  return Array.from({ length: rowCount }, (_, i) => (i < remainder ? base + 1 : base))
}
