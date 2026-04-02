import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

type ReadQueryMetric = {
  readonly table: string
  readonly operation: string
  readonly durationMs: number
  readonly rowsReturned: number
  readonly estimatedRowsRead: number
  readonly estimatedBytesRead: number | null
}

type ReadRequestMetricContext = {
  readonly requestId: string
  readonly endpoint: string
  readonly projection: string
  readonly readStrategy: string | null
  readonly triggeredBy: string | null
  readonly startedAtMs: number
  responseBytes: number | null
  responseStatus: number | null
  readonly queryMetrics: ReadQueryMetric[]
}

type ReadRequestAuditMeta = {
  readonly endpoint: string
  readonly projection: string
  readonly readStrategy?: string | null
  readonly triggeredBy?: string | null
}

const readMetricsStorage = new AsyncLocalStorage<ReadRequestMetricContext>()

function toUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function parseOptionalBooleanEnv(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) return null
  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  return null
}

function isReadAuditEnabled(): boolean {
  const explicitToggle = parseOptionalBooleanEnv(process.env.READ_AUDIT_ENABLED)
  if (explicitToggle !== null) return explicitToggle

  return process.env.NODE_ENV !== 'production'
}

function toEstimatedRows(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (value === null || value === undefined) return 0
  return 1
}

function toEstimatedBytes(value: unknown): number | null {
  if (value === null || value === undefined) return 0

  if (Array.isArray(value) && value.length > 50) return null
  if (!Array.isArray(value) && typeof value === 'object' && Object.keys(value).length > 50) {
    return null
  }

  try {
    return toUtf8ByteLength(JSON.stringify(value))
  } catch {
    return null
  }
}

function flushReadRequestMetric(context: ReadRequestMetricContext): void {
  if (!isReadAuditEnabled()) return

  const touchedTables = Array.from(new Set(context.queryMetrics.map((metric) => metric.table)))
  const queryOperations = Array.from(
    new Set(context.queryMetrics.map((metric) => `${metric.table}.${metric.operation}`)),
  )
  const totalDbTimeMs = context.queryMetrics.reduce((total, metric) => total + metric.durationMs, 0)
  const estimatedRowsReturned = context.queryMetrics.reduce(
    (total, metric) => total + metric.rowsReturned,
    0,
  )
  const estimatedRowsRead = context.queryMetrics.reduce(
    (total, metric) => total + metric.estimatedRowsRead,
    0,
  )
  const estimatedDbReadBytes = context.queryMetrics.some(
    (metric) => metric.estimatedBytesRead === null,
  )
    ? null
    : context.queryMetrics.reduce((total, metric) => total + (metric.estimatedBytesRead ?? 0), 0)
  const durationMs = Math.round((performance.now() - context.startedAtMs) * 100) / 100

  console.info(
    '[read_audit]',
    JSON.stringify({
      request_id: context.requestId,
      endpoint: context.endpoint,
      projection: context.projection,
      read_strategy: context.readStrategy,
      triggered_by: context.triggeredBy,
      duration_ms: durationMs,
      response_bytes: context.responseBytes,
      response_status: context.responseStatus,
      query_count: context.queryMetrics.length,
      query_operations: queryOperations,
      db_time_ms: Math.round(totalDbTimeMs * 100) / 100,
      estimated_rows_returned: estimatedRowsReturned,
      estimated_rows_read: estimatedRowsRead,
      estimated_db_read_bytes: estimatedDbReadBytes,
      touched_tables: touchedTables,
    }),
  )
}

export async function runWithReadRequestAudit<T>(
  meta: ReadRequestAuditMeta,
  handler: () => Promise<T>,
): Promise<T> {
  if (!isReadAuditEnabled()) {
    return handler()
  }

  const context: ReadRequestMetricContext = {
    requestId: randomUUID(),
    endpoint: meta.endpoint,
    projection: meta.projection,
    readStrategy: meta.readStrategy ?? null,
    triggeredBy: meta.triggeredBy ?? null,
    startedAtMs: performance.now(),
    responseBytes: null,
    responseStatus: null,
    queryMetrics: [],
  }

  return readMetricsStorage.run(context, async () => {
    try {
      const result = await handler()
      flushReadRequestMetric(context)
      return result
    } catch (error) {
      flushReadRequestMetric(context)
      throw error
    }
  })
}

export function readAuditedTriggerSource(request: Request): string | null {
  const headerValue = request.headers.get('x-process-read-trigger')
  if (headerValue === null) return null
  const trimmed = headerValue.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function recordReadResponseMetrics(payload: string, status: number): void {
  if (!isReadAuditEnabled()) return

  const context = readMetricsStorage.getStore()
  if (!context) return
  context.responseBytes = toUtf8ByteLength(payload)
  context.responseStatus = status
}

export function recordReadQueryMetrics(metric: ReadQueryMetric): void {
  if (!isReadAuditEnabled()) return

  const context = readMetricsStorage.getStore()
  if (!context) return
  context.queryMetrics.push(metric)
}

export async function measureAuditedReadQuery<T>(command: {
  readonly table: string
  readonly operation: string
  readonly query: () => PromiseLike<T>
  readonly resultSelector?: (result: T) => unknown
}): Promise<T> {
  if (!isReadAuditEnabled()) {
    return command.query()
  }

  const startedAtMs = performance.now()
  const result = await command.query()
  const selectedResult =
    command.resultSelector === undefined ? result : command.resultSelector(result)

  recordReadQueryMetrics({
    table: command.table,
    operation: command.operation,
    durationMs: performance.now() - startedAtMs,
    rowsReturned: toEstimatedRows(selectedResult),
    estimatedRowsRead: toEstimatedRows(selectedResult),
    estimatedBytesRead: toEstimatedBytes(selectedResult),
  })

  return result
}
