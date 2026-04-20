import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAgentLogForwarder } from '@agent/log-forwarder.ts'
import { afterEach, describe, expect, it, vi } from 'vitest'

type IngestPayload = {
  readonly lines: readonly {
    readonly sequence: number
    readonly channel: 'stdout' | 'stderr'
    readonly message: string
  }[]
}

function safeParseIngestPayload(raw: unknown): IngestPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  if (!('lines' in raw)) return null
  const linesValue = Reflect.get(raw, 'lines')
  if (!Array.isArray(linesValue)) return null

  const lines: {
    readonly sequence: number
    readonly channel: 'stdout' | 'stderr'
    readonly message: string
  }[] = []

  for (const item of linesValue) {
    if (typeof item !== 'object' || item === null) continue
    const sequence = Reflect.get(item, 'sequence')
    const channel = Reflect.get(item, 'channel')
    const message = Reflect.get(item, 'message')
    if (typeof sequence !== 'number') continue
    if (channel !== 'stdout' && channel !== 'stderr') continue
    if (typeof message !== 'string') continue
    lines.push({ sequence, channel, message })
  }

  return { lines }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

describe('createAgentLogForwarder', () => {
  const tmpDirs: string[] = []

  afterEach(() => {
    vi.unstubAllGlobals()

    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tmpDirs.length = 0
  })

  it('flushes remaining queued lines during stop()', async () => {
    const received: IngestPayload[] = []

    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const body = init?.body
      if (typeof body === 'string') {
        try {
          const parsed: unknown = JSON.parse(body)
          const payload = safeParseIngestPayload(parsed)
          if (payload) received.push(payload)
        } catch {
          // ignore invalid body
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-agent-forwarder-'))
    tmpDirs.push(baseDir)

    const logsDir = path.join(baseDir, 'logs')
    fs.mkdirSync(logsDir, { recursive: true })
    fs.writeFileSync(path.join(logsDir, 'agent.out.log'), '', 'utf8')
    fs.writeFileSync(path.join(logsDir, 'agent.err.log'), '', 'utf8')

    const forwarder = createAgentLogForwarder({
      backendUrl: 'http://example.invalid',
      agentToken: 'test-token',
      agentId: '22222222-2222-4222-8222-222222222222',
      logsDir,
      statePath: path.join(baseDir, 'state.json'),
      flushIntervalMs: 1000,
      maxBatchSize: 2,
    })

    forwarder.start()

    const logPath = path.join(logsDir, 'agent.out.log')
    fs.appendFileSync(logPath, `${['one', 'two', 'three', 'four', 'five'].join('\n')}\n`, 'utf8')

    await sleep(1200)
    await forwarder.stop()

    const receivedCount = received.reduce((sum, batch) => sum + batch.lines.length, 0)
    expect(receivedCount).toBe(5)
  })
})
