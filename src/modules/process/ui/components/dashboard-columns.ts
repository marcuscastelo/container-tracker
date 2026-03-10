import type { DashboardSortField } from '~/modules/process/ui/viewmodels/dashboard-sort.vm'

// ---------------------------------------------------------------------------
// Column Definition — single source of truth for the dashboard table
// ---------------------------------------------------------------------------

export type DashboardColumnId =
  | 'processRef'
  | 'importer'
  | 'exporter'
  | 'route'
  | 'status'
  | 'eta'
  | 'sync'
  | 'alerts'

export type DashboardColumnAlign = 'left' | 'center' | 'right'

export type DashboardColumnDef = {
  /** Stable identifier used for reorder persistence and grid track mapping. */
  readonly id: DashboardColumnId
  /** i18n key path accessor — resolved at render time via `t(keys.dashboard.table.col.<x>)`. */
  readonly labelKey: string
  /** CSS grid track width. */
  readonly width: string
  /** Sort field reference when the column is sortable. `null` means non-sortable. */
  readonly sortField: DashboardSortField | null
  /** Whether the user can reorder (drag) this column away from its position. */
  readonly reorderable: boolean
  /** Whether this column is pinned to its position (first/last). */
  readonly pinned: 'start' | 'end' | false
  /** Header text alignment. */
  readonly align: DashboardColumnAlign
}

// ---------------------------------------------------------------------------
// Canonical column registry
// ---------------------------------------------------------------------------

export const DASHBOARD_COLUMNS: readonly DashboardColumnDef[] = [
  {
    id: 'processRef',
    labelKey: 'process',
    width: '170px',
    sortField: 'processNumber',
    reorderable: false,
    pinned: 'start',
    align: 'left',
  },
  {
    id: 'importer',
    labelKey: 'importerName',
    width: '180px',
    sortField: 'importerName',
    reorderable: true,
    pinned: false,
    align: 'left',
  },
  {
    id: 'exporter',
    labelKey: 'exporterName',
    width: '180px',
    sortField: 'exporterName',
    reorderable: true,
    pinned: false,
    align: 'left',
  },
  {
    id: 'route',
    labelKey: 'route',
    width: 'minmax(100px,1fr)',
    sortField: null,
    reorderable: true,
    pinned: false,
    align: 'left',
  },
  {
    id: 'status',
    labelKey: 'status',
    width: '181px',
    sortField: 'status',
    reorderable: true,
    pinned: false,
    align: 'center',
  },
  {
    id: 'eta',
    labelKey: 'eta',
    width: '100px',
    sortField: 'eta',
    reorderable: true,
    pinned: false,
    align: 'center',
  },
  {
    id: 'sync',
    labelKey: 'sync',
    width: '80px',
    sortField: null,
    reorderable: false,
    pinned: false,
    align: 'center',
  },
  {
    id: 'alerts',
    labelKey: 'alerts',
    width: '80px',
    sortField: 'alerts',
    reorderable: false,
    pinned: 'end',
    align: 'center',
  },
] as const

/** Default column order (canonical). */
export const DEFAULT_COLUMN_ORDER: readonly DashboardColumnId[] = DASHBOARD_COLUMNS.map(
  (col) => col.id,
)

// ---------------------------------------------------------------------------
// Column reorder logic
// ---------------------------------------------------------------------------

const COLUMN_ORDER_STORAGE_KEY = 'dashboardColumnOrder'

const VALID_COLUMN_IDS: ReadonlySet<string> = new Set<string>(DEFAULT_COLUMN_ORDER)

function isValidColumnId(id: string): id is DashboardColumnId {
  return VALID_COLUMN_IDS.has(id)
}

/**
 * Validates and normalises a persisted column order.
 *
 * Constraints enforced:
 * - processRef is always first
 * - alerts is always last
 * - sync comes just before alerts (last positions)
 * - All canonical columns must be present (missing → reset to default)
 * - Unknown IDs are discarded
 */
function normaliseColumnOrder(raw: readonly string[]): readonly DashboardColumnId[] | null {
  const ids = raw.filter(isValidColumnId)

  // Every canonical column must be present.
  if (ids.length !== DEFAULT_COLUMN_ORDER.length) return null
  const idSet = new Set(ids)
  for (const expected of DEFAULT_COLUMN_ORDER) {
    if (!idSet.has(expected)) return null
  }

  // Enforce pinning constraints.
  if (ids[0] !== 'processRef') return null
  if (ids[ids.length - 1] !== 'alerts') return null
  if (ids[ids.length - 2] !== 'sync') return null

  return ids
}

export function readColumnOrderFromLocalStorage(): readonly DashboardColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMN_ORDER
  try {
    const stored = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY)
    if (!stored) return DEFAULT_COLUMN_ORDER
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return DEFAULT_COLUMN_ORDER
    const normalised = normaliseColumnOrder(parsed)
    return normalised ?? DEFAULT_COLUMN_ORDER
  } catch {
    return DEFAULT_COLUMN_ORDER
  }
}

export function writeColumnOrderToLocalStorage(order: readonly DashboardColumnId[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Silently ignore write failures.
  }
}

/**
 * Moves a column to a new index, respecting pinning constraints.
 * Returns `null` when the move is invalid.
 */
export function moveColumn(
  currentOrder: readonly DashboardColumnId[],
  columnId: DashboardColumnId,
  targetIndex: number,
): readonly DashboardColumnId[] | null {
  const col = DASHBOARD_COLUMNS.find((c) => c.id === columnId)
  if (!col || !col.reorderable) return null

  const sourceIndex = currentOrder.indexOf(columnId)
  if (sourceIndex === -1) return null

  // Clamp target within the reorderable range (after processRef, before sync/alerts).
  const minIndex = 1 // processRef is pinned at 0
  const maxIndex = currentOrder.length - 3 // sync and alerts occupy the last 2 slots
  const clampedTarget = Math.max(minIndex, Math.min(maxIndex, targetIndex))

  if (clampedTarget === sourceIndex) return null

  const next = [...currentOrder]
  next.splice(sourceIndex, 1)
  next.splice(clampedTarget, 0, columnId)

  return next
}

// ---------------------------------------------------------------------------
// Grid template helpers
// ---------------------------------------------------------------------------

const COLUMN_MAP = new Map(DASHBOARD_COLUMNS.map((col) => [col.id, col]))

export function getColumnDef(id: DashboardColumnId): DashboardColumnDef {
  const def = COLUMN_MAP.get(id)
  if (!def) throw new Error(`Unknown dashboard column id: ${id}`)
  return def
}

/**
 * Builds a CSS grid-template-columns value from the given column order.
 *
 * @example
 * buildGridTemplate(DEFAULT_COLUMN_ORDER)
 * // → "170px 180px 180px minmax(200px,1fr) 140px 100px 56px 56px"
 */
export function buildGridTemplate(order: readonly DashboardColumnId[]): string {
  return order.map((id) => getColumnDef(id).width).join(' ')
}
