export function createAgentScheduler(command) {
    let timer = null;
    let running = false;
    let pendingWake = false;
    let pendingReason = null;
    const dequeueReason = () => {
        if (pendingReason) {
            const reason = pendingReason;
            pendingReason = null;
            return reason;
        }
        return 'coalesced';
    };
    const runPendingCycles = async (initialReason) => {
        if (running) {
            if (initialReason !== 'coalesced') {
                pendingWake = true;
                pendingReason = initialReason;
            }
            return;
        }
        running = true;
        let reason = initialReason;
        try {
            for (;;) {
                try {
                    await command.runCycle(reason);
                }
                catch (error) {
                    command.onRunError({ reason, error });
                }
                if (!pendingWake) {
                    break;
                }
                pendingWake = false;
                reason = dequeueReason();
            }
        }
        finally {
            running = false;
        }
    };
    const triggerRun = (reason) => {
        void runPendingCycles(reason);
    };
    const start = () => {
        if (timer)
            return;
        triggerRun('startup');
        timer = setInterval(() => {
            triggerRun('interval');
        }, command.intervalMs);
    };
    const stop = () => {
        if (!timer)
            return;
        clearInterval(timer);
        timer = null;
    };
    return {
        start,
        stop,
        triggerRun,
    };
}
