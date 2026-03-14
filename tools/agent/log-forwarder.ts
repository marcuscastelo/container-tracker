import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_QUEUE_CAPACITY = 5000
const DEFAULT_FLUSH_INTERVAL_MS = 1000
const DEFAULT_MAX_BATCH_SIZE = 200
const DEFAULT_MAX_MESSAGE_LENGTH = 8192
const DEFAULT_MAX_READ_BYTES_PER_POLL = 256 * 1024

type AgentLogChannel = 'stdout' | 'stderr'

type QueuedLogLine = {
  readonly sequence: number
  readonly channel: AgentLogChannel
  readonly message: string
  readonly occurredAt: string
  readonly truncated: boolean
}

type LogTailState = {
  readonly channel: AgentLogChannel
  readonly filePath: string
  offset: number
  residual: string
  inode: number | null
}

type ForwarderStateFile = {
  readonly nextSequence: number
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

function safeReadForwarderState(filePath: string): ForwarderStateFile | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'nextSequence' in parsed &&
      typeof parsed.nextSequence === 'number' &&
      Number.isInteger(parsed.nextSequence) &&
      parsed.nextSequence > 0
    ) {
      return {
        nextSequence: parsed.nextSequence,
      }
    }
  } catch {
    // forwarder state corruption should not prevent runtime startup
  }

  return null
}

function writeForwarderState(command: {
  readonly filePath: string
  readonly nextSequence: number
}): void {
  const dir = path.dirname(command.filePath)
  fs.mkdirSync(dir, { recursive: true })
  const tempPath = `${command.filePath}.tmp`
  fs.writeFileSync(
    tempPath,
    `${JSON.stringify({ nextSequence: command.nextSequence }, null, 2)}\n`,
    'utf8',
  )
  fs.renameSync(tempPath, command.filePath)
}

function initializeTailState(command: {
  readonly channel: AgentLogChannel
  readonly filePath: string
}): LogTailState {
  const existingSize = (() => {
    try {
      if (!fs.existsSync(command.filePath)) {
        return 0
      }
      return fs.statSync(command.filePath).size
    } catch {
      return 0
    }
  })()

  return {
    channel: command.channel,
    filePath: command.filePath,
    offset: existingSize,
    residual: '',
    inode: null,
  }
}

function readNewLines(command: {
  readonly state: LogTailState
  readonly maxReadBytes: number
}): readonly string[] {
  const currentPath = command.state.filePath
  if (!fs.existsSync(currentPath)) {
    command.state.offset = 0
    command.state.residual = ''
    command.state.inode = null
    return []
  }

  const stat = fs.statSync(currentPath)

  if (command.state.inode !== null && stat.ino !== command.state.inode) {
    command.state.offset = 0
    command.state.residual = ''
  }

  if (stat.size < command.state.offset) {
    command.state.offset = 0
    command.state.residual = ''
  }

  if (stat.size <= command.state.offset) {
    command.state.inode = stat.ino
    return []
  }

  const readLength = Math.min(command.maxReadBytes, stat.size - command.state.offset)
  if (readLength <= 0) {
    command.state.inode = stat.ino
    return []
  }

  const buffer = Buffer.allocUnsafe(readLength)
  const fd = fs.openSync(currentPath, 'r')

  try {
    const bytesRead = fs.readSync(fd, buffer, 0, readLength, command.state.offset)
    command.state.offset += bytesRead
    command.state.inode = stat.ino

    if (bytesRead <= 0) {
      return []
    }

    const text = command.state.residual + buffer.subarray(0, bytesRead).toString('utf8')
    const split = text.split(/\r?\n/u)
    command.state.residual = split.pop() ?? ''
    return split
  } finally {
    fs.closeSync(fd)
  }
}

function withTruncation(command: { readonly message: string; readonly maxLength: number }): {
  readonly message: string
  readonly truncated: boolean
} {
  if (command.message.length <= command.maxLength) {
    return {
      message: command.message,
      truncated: false,
    }
  }

  return {
    message: command.message.slice(0, command.maxLength),
    truncated: true,
  }
}

function computeBackoffMs(failures: number): number {
  const exponential = Math.min(500 * 2 ** Math.max(0, failures - 1), 30_000)
  return Math.max(500, Math.floor(exponential))
}

export type AgentLogForwarder = {
  start: () => void
  stop: () => void
}

export function createAgentLogForwarder(command: {
  readonly backendUrl: string
  readonly agentToken: string
  readonly agentId: string
  readonly logsDir: string
  readonly statePath: string
  readonly queueCapacity?: number
  readonly flushIntervalMs?: number
  readonly maxBatchSize?: number
  readonly maxMessageLength?: number
  readonly maxReadBytesPerPoll?: number
}): AgentLogForwarder {
  const queueCapacity = command.queueCapacity ?? DEFAULT_QUEUE_CAPACITY
  const flushIntervalMs = command.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
  const maxBatchSize = command.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE
  const maxMessageLength = command.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH
  const maxReadBytesPerPoll = command.maxReadBytesPerPoll ?? DEFAULT_MAX_READ_BYTES_PER_POLL

  const loadedState = safeReadForwarderState(command.statePath)
  let nextSequence = loadedState?.nextSequence ?? 1
  let queue: QueuedLogLine[] = []
  let droppedLines = 0
  let flushFailures = 0
  let nextFlushAtMs = 0
  let running = false
  let pollingHandle: ReturnType<typeof setInterval> | null = null
  let flushing = false

  const outTail = initializeTailState({
    channel: 'stdout',
    filePath: path.join(command.logsDir, 'agent.out.log'),
  })

  const errTail = initializeTailState({
    channel: 'stderr',
    filePath: path.join(command.logsDir, 'agent.err.log'),
  })

  const allocateSequence = (): number => {
    const sequence = nextSequence
    nextSequence += 1
    return sequence
  }

  const enqueue = (payload: {
    readonly channel: AgentLogChannel
    readonly message: string
  }): void => {
    if (queue.length >= queueCapacity) {
      droppedLines += 1
      return
    }

    const normalizedMessage = normalizeOptionalText(payload.message) ?? ''
    const safeMessage = withTruncation({
      message: normalizedMessage,
      maxLength: maxMessageLength,
    })

    queue.push({
      sequence: allocateSequence(),
      channel: payload.channel,
      message: safeMessage.message,
      occurredAt: new Date().toISOString(),
      truncated: safeMessage.truncated,
    })
  }

  const enqueueDropSummaryIfNeeded = (): void => {
    if (droppedLines <= 0) return
    if (queue.length >= queueCapacity) return

    const droppedNow = droppedLines
    droppedLines = 0

    enqueue({
      channel: 'stderr',
      message: `[agent-log-forwarder] dropped ${droppedNow} log lines due to local queue overflow`,
    })
  }

  const pollLogFiles = (): void => {
    const readOut = readNewLines({
      state: outTail,
      maxReadBytes: maxReadBytesPerPoll,
    })
    for (const line of readOut) {
      enqueue({
        channel: 'stdout',
        message: line,
      })
    }

    const readErr = readNewLines({
      state: errTail,
      maxReadBytes: maxReadBytesPerPoll,
    })
    for (const line of readErr) {
      enqueue({
        channel: 'stderr',
        message: line,
      })
    }
  }

  const flushQueue = async (): Promise<void> => {
    if (!running || flushing) return
    if (Date.now() < nextFlushAtMs) return

    enqueueDropSummaryIfNeeded()

    if (queue.length === 0) {
      return
    }

    const batch = queue.slice(0, maxBatchSize)

    flushing = true
    try {
      const response = await fetch(`${command.backendUrl}/api/agent/logs`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${command.agentToken}`,
          'content-type': 'application/json',
          'x-agent-id': command.agentId,
          'user-agent': `container-tracker-agent/${command.agentId}`,
        },
        body: JSON.stringify({
          lines: batch.map((line) => ({
            sequence: line.sequence,
            channel: line.channel,
            message: line.message,
            occurred_at: line.occurredAt,
            truncated: line.truncated,
          })),
        }),
      })

      if (!response.ok) {
        const details = await response.text().catch(() => '')
        throw new Error(`log ingest failed (${response.status}): ${details}`)
      }

      queue = queue.slice(batch.length)
      flushFailures = 0
      nextFlushAtMs = 0
      writeForwarderState({
        filePath: command.statePath,
        nextSequence,
      })
    } catch (error) {
      flushFailures += 1
      nextFlushAtMs = Date.now() + computeBackoffMs(flushFailures)
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[agent-log-forwarder] flush failed: ${message}`)
    } finally {
      flushing = false
    }
  }

  return {
    start() {
      if (running) return

      fs.mkdirSync(command.logsDir, { recursive: true })
      running = true

      pollingHandle = setInterval(() => {
        try {
          pollLogFiles()
          void flushQueue()
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          console.warn(`[agent-log-forwarder] polling failed: ${message}`)
        }
      }, flushIntervalMs)
    },

    stop() {
      if (!running) return
      running = false

      if (pollingHandle) {
        clearInterval(pollingHandle)
        pollingHandle = null
      }

      writeForwarderState({
        filePath: command.statePath,
        nextSequence,
      })
    },
  }
}
