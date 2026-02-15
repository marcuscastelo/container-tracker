/**
 * Transshipment info — derived attribute, NOT a status.
 *
 * @see docs/master-consolidated-0209.md §2.7
 */
export type TransshipmentInfo = {
  hasTransshipment: boolean
  transshipmentCount: number
  /** Unique ports involved in LOAD/DISCHARGE pairs */
  ports: string[]
}
