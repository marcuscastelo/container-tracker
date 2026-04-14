import fs from 'node:fs';
import path from 'node:path';
const DEFAULT_ROTATION_CHECK_INTERVAL_MS = 2000;
const DEFAULT_REOPEN_BACKOFF_MS = 2000;
const DEFAULT_MAX_BUFFER_BYTES = 256 * 1024;
function toErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function isErrorCode(command) {
    const error = command.error;
    if (typeof error !== 'object' || error === null) {
        return false;
    }
    const code = Reflect.get(error, 'code');
    return code === command.code;
}
function getChunkSizeBytes(chunk) {
    if (typeof chunk === 'string') {
        return Buffer.byteLength(chunk);
    }
    return chunk.byteLength;
}
function resolveDefaultDeps() {
    return {
        createWriteStream(filePath, options) {
            return fs.createWriteStream(filePath, options);
        },
        mkdirSync(filePath, options) {
            fs.mkdirSync(filePath, options);
        },
        stat(filePath) {
            return fs.promises.stat(filePath);
        },
        rm(filePath, options) {
            return fs.promises.rm(filePath, options);
        },
        rename(sourcePath, targetPath) {
            return fs.promises.rename(sourcePath, targetPath);
        },
        now() {
            return Date.now();
        },
        setInterval,
        clearInterval,
        warn(message) {
            console.warn(message);
        },
    };
}
export function createRotatingChunkWriter(command, providedDeps) {
    const defaultDeps = resolveDefaultDeps();
    const deps = {
        createWriteStream: providedDeps?.createWriteStream ?? defaultDeps.createWriteStream,
        mkdirSync: providedDeps?.mkdirSync ?? defaultDeps.mkdirSync,
        stat: providedDeps?.stat ?? defaultDeps.stat,
        rm: providedDeps?.rm ?? defaultDeps.rm,
        rename: providedDeps?.rename ?? defaultDeps.rename,
        now: providedDeps?.now ?? defaultDeps.now,
        setInterval: providedDeps?.setInterval ?? defaultDeps.setInterval,
        clearInterval: providedDeps?.clearInterval ?? defaultDeps.clearInterval,
        warn: providedDeps?.warn ?? defaultDeps.warn,
    };
    deps.mkdirSync(path.dirname(command.logPath), { recursive: true });
    let stream = null;
    let closed = false;
    let rotating = false;
    let bufferedBytes = 0;
    let nextStreamOpenAttemptAtMs = 0;
    let lastWarnedErrorMessage = null;
    let buffer = [];
    const dropOverflowingBufferedChunks = () => {
        while (bufferedBytes > DEFAULT_MAX_BUFFER_BYTES && buffer.length > 0) {
            const droppedChunk = buffer.shift();
            if (droppedChunk === undefined) {
                continue;
            }
            bufferedBytes -= getChunkSizeBytes(droppedChunk);
        }
    };
    const bufferChunk = (chunk) => {
        buffer.push(chunk);
        bufferedBytes += getChunkSizeBytes(chunk);
        dropOverflowingBufferedChunks();
    };
    const flushBuffer = () => {
        if (!stream || buffer.length === 0) {
            return;
        }
        const pendingChunks = buffer;
        buffer = [];
        bufferedBytes = 0;
        for (const chunk of pendingChunks) {
            if (!stream || stream.destroyed) {
                bufferChunk(chunk);
                continue;
            }
            stream.write(chunk);
        }
    };
    const handleStreamError = (failedStream, error) => {
        if (stream !== failedStream) {
            return;
        }
        stream = null;
        nextStreamOpenAttemptAtMs = deps.now() + DEFAULT_REOPEN_BACKOFF_MS;
        const errorMessage = `[supervisor] failed to mirror runtime log to ${command.logPath}: ${toErrorMessage(error)}`;
        if (lastWarnedErrorMessage !== errorMessage) {
            deps.warn(errorMessage);
            lastWarnedErrorMessage = errorMessage;
        }
        failedStream.destroy();
    };
    const ensureStream = () => {
        if (closed || rotating || stream || deps.now() < nextStreamOpenAttemptAtMs) {
            return;
        }
        const nextStream = deps.createWriteStream(command.logPath, { flags: 'a' });
        nextStream.on('error', (error) => {
            handleStreamError(nextStream, error);
        });
        nextStream.on('open', () => {
            if (stream !== nextStream) {
                return;
            }
            lastWarnedErrorMessage = null;
            flushBuffer();
        });
        stream = nextStream;
    };
    const closeActiveStream = async () => {
        const currentStream = stream;
        stream = null;
        if (!currentStream || currentStream.destroyed) {
            return;
        }
        await new Promise((resolve) => {
            let settled = false;
            const settle = () => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve();
            };
            currentStream.once('close', settle);
            currentStream.once('finish', settle);
            currentStream.once('error', settle);
            currentStream.end(settle);
        });
    };
    const rotate = async () => {
        if (closed || rotating) {
            return;
        }
        rotating = true;
        try {
            await closeActiveStream();
            const rotationPath = `${command.logPath}.1`;
            await deps.rm(rotationPath, { force: true }).catch(() => undefined);
            await deps.rename(command.logPath, rotationPath).catch(() => undefined);
            nextStreamOpenAttemptAtMs = 0;
            ensureStream();
            flushBuffer();
        }
        finally {
            rotating = false;
        }
    };
    ensureStream();
    const checkHandle = deps.setInterval(() => {
        void (async () => {
            if (closed || rotating) {
                return;
            }
            ensureStream();
            try {
                const stat = await deps.stat(command.logPath);
                if (stat.size <= command.maxSizeBytes) {
                    return;
                }
                await rotate();
            }
            catch (error) {
                if (isErrorCode({ code: 'ENOENT', error })) {
                    return;
                }
            }
        })();
    }, DEFAULT_ROTATION_CHECK_INTERVAL_MS);
    checkHandle.unref?.();
    return {
        write(chunk) {
            if (closed) {
                return;
            }
            if (rotating) {
                bufferChunk(chunk);
                return;
            }
            ensureStream();
            if (!stream || stream.destroyed) {
                bufferChunk(chunk);
                return;
            }
            if (buffer.length > 0) {
                bufferChunk(chunk);
                flushBuffer();
                return;
            }
            stream.write(chunk);
        },
        async close() {
            if (closed) {
                return;
            }
            closed = true;
            deps.clearInterval(checkHandle);
            flushBuffer();
            await closeActiveStream();
        },
    };
}
