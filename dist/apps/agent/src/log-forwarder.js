import fs from 'node:fs';
import path from 'node:path';
const DEFAULT_QUEUE_CAPACITY = 5000;
const DEFAULT_FLUSH_INTERVAL_MS = 1000;
const DEFAULT_MAX_BATCH_SIZE = 200;
const DEFAULT_MAX_MESSAGE_LENGTH = 8192;
const DEFAULT_MAX_READ_BYTES_PER_POLL = 256 * 1024;
function resetTailState(state) {
    state.offset = 0;
    state.residual = '';
    state.inode = null;
}
function isMissingFileError(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    const code = Reflect.get(error, 'code');
    return code === 'ENOENT';
}
function normalizeOptionalText(value) {
    if (typeof value !== 'string')
        return undefined;
    const normalized = value.trim();
    if (normalized.length === 0)
        return undefined;
    return normalized;
}
function safeReadForwarderState(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' &&
            parsed !== null &&
            'nextSequence' in parsed &&
            typeof parsed.nextSequence === 'number' &&
            Number.isInteger(parsed.nextSequence) &&
            parsed.nextSequence > 0) {
            return {
                nextSequence: parsed.nextSequence,
            };
        }
    }
    catch {
        // forwarder state corruption should not prevent runtime startup
    }
    return null;
}
function writeForwarderState(command) {
    const dir = path.dirname(command.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tempPath = `${command.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify({ nextSequence: command.nextSequence }, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, command.filePath);
}
function initializeTailState(command) {
    const existingSize = (() => {
        try {
            if (!fs.existsSync(command.filePath)) {
                return 0;
            }
            return fs.statSync(command.filePath).size;
        }
        catch {
            return 0;
        }
    })();
    return {
        channel: command.channel,
        filePath: command.filePath,
        offset: existingSize,
        residual: '',
        inode: null,
    };
}
function readNewLines(command) {
    const currentPath = command.state.filePath;
    let stat;
    try {
        stat = fs.statSync(currentPath);
    }
    catch (error) {
        if (isMissingFileError(error)) {
            resetTailState(command.state);
            return [];
        }
        throw error;
    }
    if (command.state.inode !== null && stat.ino !== command.state.inode) {
        command.state.offset = 0;
        command.state.residual = '';
    }
    if (stat.size < command.state.offset) {
        command.state.offset = 0;
        command.state.residual = '';
    }
    if (stat.size <= command.state.offset) {
        command.state.inode = stat.ino;
        return [];
    }
    const readLength = Math.min(command.maxReadBytes, stat.size - command.state.offset);
    if (readLength <= 0) {
        command.state.inode = stat.ino;
        return [];
    }
    const buffer = Buffer.allocUnsafe(readLength);
    let fd = null;
    try {
        try {
            fd = fs.openSync(currentPath, 'r');
        }
        catch (error) {
            if (isMissingFileError(error)) {
                resetTailState(command.state);
                return [];
            }
            throw error;
        }
        const bytesRead = fs.readSync(fd, buffer, 0, readLength, command.state.offset);
        command.state.offset += bytesRead;
        command.state.inode = stat.ino;
        if (bytesRead <= 0) {
            return [];
        }
        const text = command.state.residual + buffer.subarray(0, bytesRead).toString('utf8');
        const split = text.split(/\r?\n/u);
        command.state.residual = split.pop() ?? '';
        return split;
    }
    catch (error) {
        if (isMissingFileError(error)) {
            resetTailState(command.state);
            return [];
        }
        throw error;
    }
    finally {
        if (fd !== null) {
            fs.closeSync(fd);
        }
    }
}
function withTruncation(command) {
    if (command.message.length <= command.maxLength) {
        return {
            message: command.message,
            truncated: false,
        };
    }
    return {
        message: command.message.slice(0, command.maxLength),
        truncated: true,
    };
}
function computeBackoffMs(failures) {
    const exponential = Math.min(500 * 2 ** Math.max(0, failures - 1), 30_000);
    return Math.max(500, Math.floor(exponential));
}
export function createAgentLogForwarder(command) {
    const queueCapacity = command.queueCapacity ?? DEFAULT_QUEUE_CAPACITY;
    const flushIntervalMs = command.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    const maxBatchSize = command.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    const maxMessageLength = command.maxMessageLength ?? DEFAULT_MAX_MESSAGE_LENGTH;
    const maxReadBytesPerPoll = command.maxReadBytesPerPoll ?? DEFAULT_MAX_READ_BYTES_PER_POLL;
    const loadedState = safeReadForwarderState(command.statePath);
    let nextSequence = loadedState?.nextSequence ?? 1;
    let queue = [];
    let droppedLines = 0;
    let flushFailures = 0;
    let nextFlushAtMs = 0;
    let running = false;
    let pollingHandle = null;
    let flushing = false;
    let flushInFlight = null;
    const outTail = initializeTailState({
        channel: 'stdout',
        filePath: path.join(command.logsDir, 'agent.out.log'),
    });
    const errTail = initializeTailState({
        channel: 'stderr',
        filePath: path.join(command.logsDir, 'agent.err.log'),
    });
    const allocateSequence = () => {
        const sequence = nextSequence;
        nextSequence += 1;
        return sequence;
    };
    const enqueue = (payload) => {
        if (queue.length >= queueCapacity) {
            droppedLines += 1;
            return;
        }
        const normalizedMessage = normalizeOptionalText(payload.message) ?? '';
        const safeMessage = withTruncation({
            message: normalizedMessage,
            maxLength: maxMessageLength,
        });
        queue.push({
            sequence: allocateSequence(),
            channel: payload.channel,
            message: safeMessage.message,
            occurredAt: new Date().toISOString(),
            truncated: safeMessage.truncated,
        });
    };
    const enqueueDropSummaryIfNeeded = () => {
        if (droppedLines <= 0)
            return;
        if (queue.length >= queueCapacity)
            return;
        const droppedNow = droppedLines;
        droppedLines = 0;
        enqueue({
            channel: 'stderr',
            message: `[agent-log-forwarder] dropped ${droppedNow} log lines due to local queue overflow`,
        });
    };
    const pollLogFiles = () => {
        const readOut = readNewLines({
            state: outTail,
            maxReadBytes: maxReadBytesPerPoll,
        });
        for (const line of readOut) {
            enqueue({
                channel: 'stdout',
                message: line,
            });
        }
        const readErr = readNewLines({
            state: errTail,
            maxReadBytes: maxReadBytesPerPoll,
        });
        for (const line of readErr) {
            enqueue({
                channel: 'stderr',
                message: line,
            });
        }
    };
    const flushQueueOnce = async (options) => {
        if ((!running && !options?.force) || flushing)
            return { ok: true, flushed: 0 };
        if (!options?.force && Date.now() < nextFlushAtMs)
            return { ok: true, flushed: 0 };
        enqueueDropSummaryIfNeeded();
        if (queue.length === 0) {
            return { ok: true, flushed: 0 };
        }
        const batch = queue.slice(0, maxBatchSize);
        flushing = true;
        const flushPromise = (async () => {
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
                    ...(options?.signal === undefined ? {} : { signal: options.signal }),
                });
                if (!response.ok) {
                    const details = await response.text().catch(() => '');
                    throw new Error(`log ingest failed (${response.status}): ${details}`);
                }
                queue = queue.slice(batch.length);
                flushFailures = 0;
                nextFlushAtMs = 0;
                writeForwarderState({
                    filePath: command.statePath,
                    nextSequence,
                });
                return { ok: true, flushed: batch.length };
            }
            catch (error) {
                flushFailures += 1;
                nextFlushAtMs = Date.now() + computeBackoffMs(flushFailures);
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`[agent-log-forwarder] flush failed: ${message}`);
                return { ok: false, flushed: 0 };
            }
            finally {
                flushing = false;
                flushInFlight = null;
            }
        })();
        flushInFlight = flushPromise;
        try {
            return await flushPromise;
        }
        finally {
            // handled inside flushPromise finally
        }
    };
    return {
        start() {
            if (running)
                return;
            fs.mkdirSync(command.logsDir, { recursive: true });
            running = true;
            pollingHandle = setInterval(() => {
                try {
                    pollLogFiles();
                    void flushQueueOnce();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    console.warn(`[agent-log-forwarder] polling failed: ${message}`);
                }
            }, flushIntervalMs);
        },
        async stop() {
            if (!running)
                return;
            if (pollingHandle) {
                clearInterval(pollingHandle);
                pollingHandle = null;
            }
            const flushTimeoutMs = 1500;
            const deadlineMs = Date.now() + flushTimeoutMs;
            const abortController = new AbortController();
            const timeoutHandle = setTimeout(() => abortController.abort(), flushTimeoutMs);
            try {
                if (flushInFlight) {
                    await flushInFlight.catch(() => ({ ok: false, flushed: 0 }));
                }
                for (;;) {
                    if (queue.length === 0)
                        break;
                    if (Date.now() >= deadlineMs)
                        break;
                    const result = await flushQueueOnce({ force: true, signal: abortController.signal });
                    if (!result.ok)
                        break;
                    if (result.flushed <= 0)
                        break;
                }
            }
            finally {
                clearTimeout(timeoutHandle);
            }
            running = false;
            writeForwarderState({
                filePath: command.statePath,
                nextSequence,
            });
        },
    };
}
