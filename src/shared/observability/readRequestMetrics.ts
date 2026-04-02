import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

type ReadQueryMetric = {
  readonly table: string
  readonly operation: string
  readonly durationMs: number
  readonly rowsReturned: number
  readonly estimatedRowsRead: number
  readonly estimatedBytesRead: number
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

function toEstimatedRows(value: unknown): number {
  if (Array.isArray(value)) return value.length
  if (value === null || value === undefined) return 0
  return 1
}

function toEstimatedBytes(value: unknown): number {
  if (value === null || value === undefined) return 0
  try {
    return toUtf8ByteLength(JSON.stringify(value))
  } catch {
    return 0
  }
}

function flushReadRequestMetric(context: ReadRequestMetricContext): void {
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
  const estimatedDbReadBytes = context.queryMetrics.reduce(
    (total, metric) => total + metric.estimatedBytesRead,
    0,
  )
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
  const context = readMetricsStorage.getStore()
  if (!context) return
  context.responseBytes = toUtf8ByteLength(payload)
  context.responseStatus = status
}

export function recordReadQueryMetrics(metric: ReadQueryMetric): void {
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
