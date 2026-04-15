import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import {
  type ChunkWritable,
  createRotatingChunkWriter,
} from '@agent/runtime/infrastructure/runtime-stdio-log-writer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class StreamOpenError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'StreamOpenError'
    this.code = code
  }
}

class TestChunkStream extends EventEmitter implements ChunkWritable {
  destroyed = false

  readonly writes: string[] = []

  constructor(command?: {
    readonly openError?: Error
  }) {
    super()

    queueMicrotask(() => {
      if (command?.openError) {
        this.emit('error', command.openError)
        return
      }

      this.emit('open')
    })
  }

  write(chunk: Buffer | string): boolean {
    if (this.destroyed) {
      return false
    }

    this.writes.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
    return true
  }

  end(callback?: () => void): void {
    if (this.destroyed) {
      callback?.()
      return
    }

    this.destroyed = true
    callback?.()
    this.emit('finish')
    this.emit('close')
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }

    this.destroyed = true
    this.emit('close')
  }
}

describe('runtime stdio log writer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries after a transient stream open error instead of crashing the supervisor', async () => {
    const logPath = path.join(os.tmpdir(), 'agent-runtime-stdio-log-writer.out.log')
    const warnings: string[] = []
    let recoveredStream: TestChunkStream | null = null
    let nowMs = 0
    let createdStreamCount = 0

    const writer = createRotatingChunkWriter(
      {
        logPath,
        maxSizeBytes: 1024,
      },
      {
        createWriteStream() {
          createdStreamCount += 1
          if (createdStreamCount === 1) {
            return new TestChunkStream({
              openError: new StreamOpenError('resource busy or locked', 'EBUSY'),
            })
          }

          recoveredStream = new TestChunkStream()
          return recoveredStream
        },
        mkdirSync() {
          // No-op for isolated unit test.
        },
        stat: async () => ({ size: 0 }),
        rm: async () => undefined,
        rename: async () => undefined,
        now: () => nowMs,
        setInterval,
        clearInterval,
        warn(message) {
          warnings.push(message)
        },
      },
    )

    writer.write('lost-during-lock\n')
    await Promise.resolve()

    writer.write('buffered-after-lock\n')
    nowMs = 2_000
    await vi.advanceTimersByTimeAsync(2_000)
    await Promise.resolve()

    expect(warnings).toContain(
      `[supervisor] failed to mirror runtime log to ${logPath}: resource busy or locked`,
    )
    expect(recoveredStream?.writes.join('')).toContain('buffered-after-lock\n')

    await expect(writer.close()).resolves.toBeUndefined()
  })
})
