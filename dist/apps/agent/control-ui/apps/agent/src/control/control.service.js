import { ControlCommandResultSchema } from './control.contracts.js';
import { createAgentControlLocalService } from '../control-core/local-control-service.js';
function toCommandResult(command) {
    return ControlCommandResultSchema.parse({
        commandId: command.commandId,
        status: 'completed',
        executedAt: new Date().toISOString(),
        message: command.message,
        snapshot: command.snapshot,
    });
}
async function readSnapshot(service) {
    const syncResult = await service.getAgentOperationalSnapshot();
    return syncResult.snapshot;
}
export function createControlService(command) {
    const localService = command.localService ?? createAgentControlLocalService({ layout: command.layout });
    return {
        ...localService,
        async dispatch(controlCommand) {
            if (controlCommand.type === 'start-agent') {
                const result = await localService.startAgent();
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'stop-agent') {
                const result = await localService.stopAgent();
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'restart-agent') {
                const result = await localService.restartAgent();
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'pause-updates') {
                const result = await localService.pauseUpdates();
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'resume-updates') {
                const result = await localService.resumeUpdates();
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'change-channel') {
                const result = await localService.changeChannel(controlCommand.payload.channel);
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'set-blocked-versions') {
                const result = await localService.setBlockedVersions(controlCommand.payload.versions);
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'update-config') {
                const result = await localService.updateConfig(controlCommand.payload.patch);
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'set-backend-url') {
                const result = await localService.setBackendUrl(controlCommand.payload.backendUrl);
                const snapshot = await readSnapshot(localService);
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot,
                });
            }
            if (controlCommand.type === 'activate-release') {
                const result = await localService.activateRelease(controlCommand.payload.version);
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            if (controlCommand.type === 'rollback-release') {
                const result = await localService.rollbackRelease();
                return toCommandResult({
                    commandId: controlCommand.id,
                    message: result.message,
                    snapshot: result.snapshot,
                });
            }
            const result = await localService.executeLocalReset();
            return toCommandResult({
                commandId: controlCommand.id,
                message: result.message,
                snapshot: result.snapshot,
            });
        },
    };
}
