import type { SyncAllProcessesRequestResult } from '~/modules/process/ui/api/processSync.api'
import type {
  DashboardProcessSyncIssueVM,
  DashboardSyncBatchEnqueuedTargetVM,
  DashboardSyncBatchProblemTargetVM,
  DashboardSyncBatchReasonCode,
  DashboardSyncBatchResultVM,
} from '~/modules/process/ui/viewmodels/dashboard-sync-batch-result.vm'
import type { TranslationKeys } from '~/shared/localization/translationTypes'
import { toCarrierDisplayLabel } from '~/shared/utils/carrierDisplay'

const MAX_ROW_TOOLTIP_ITEMS = 3

function toProcessLabel(processReference: string | null, processId: string): string {
  const trimmedReference = processReference?.trim() ?? ''
  if (trimmedReference.length > 0) {
    return trimmedReference
  }

  return `<${processId.slice(0, 8)}>`
}

function toProviderLabel(provider: string): string {
  return toCarrierDisplayLabel(provider) ?? provider
}

function toReasonLabel(command: {
  readonly reasonCode: DashboardSyncBatchReasonCode
  readonly t: (key: string, params?: Readonly<Record<string, unknown>>) => string
  readonly keys: TranslationKeys
}): string {
  switch (command.reasonCode) {
    case 'UNSUPPORTED_PROVIDER':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.unsupportedProvider)
    case 'DUPLICATE_OPEN_REQUEST':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.duplicateOpenRequest)
    case 'MISSING_REQUIRED_DATA':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.missingRequiredData)
    case 'INELIGIBLE_TARGET':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.ineligibleTarget)
    case 'ENQUEUE_FAILED':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.enqueueFailed)
    case 'INFRASTRUCTURE_ERROR':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.infrastructureError)
    case 'UNEXPECTED_ERROR':
      return command.t(command.keys.dashboard.syncBatch.reasonCodes.unexpectedError)
  }
}

function toEnqueuedTargetVm(
  source: SyncAllProcessesRequestResult['payload']['enqueuedTargets'][number],
): DashboardSyncBatchEnqueuedTargetVM {
  return {
    processId: source.processId,
    processReference: source.processReference,
    processLabel: toProcessLabel(source.processReference, source.processId),
    containerNumber: source.containerNumber,
    provider: source.provider,
    providerLabel: toProviderLabel(source.provider),
    syncRequestId: source.syncRequestId,
  }
}

function toProblemTargetVm(command: {
  readonly source:
    | SyncAllProcessesRequestResult['payload']['skippedTargets'][number]
    | SyncAllProcessesRequestResult['payload']['failedTargets'][number]
  readonly t: (key: string, params?: Readonly<Record<string, unknown>>) => string
  readonly keys: TranslationKeys
}): DashboardSyncBatchProblemTargetVM {
  const reasonLabel = toReasonLabel({
    reasonCode: command.source.reasonCode,
    t: command.t,
    keys: command.keys,
  })

  return {
    processId: command.source.processId,
    processReference: command.source.processReference,
    processLabel: toProcessLabel(command.source.processReference, command.source.processId),
    containerNumber: command.source.containerNumber,
    provider: command.source.provider,
    providerLabel: toProviderLabel(command.source.provider),
    reasonCode: command.source.reasonCode,
    reasonLabel,
    reasonMessage: command.source.reasonMessage,
  }
}

function toProblemLine(target: DashboardSyncBatchProblemTargetVM): string {
  return `${target.containerNumber} · ${target.providerLabel} · ${target.reasonLabel}`
}

function toRowIssueTooltip(command: {
  readonly failedTargets: readonly DashboardSyncBatchProblemTargetVM[]
  readonly skippedTargets: readonly DashboardSyncBatchProblemTargetVM[]
  readonly t: (key: string, params?: Readonly<Record<string, unknown>>) => string
  readonly keys: TranslationKeys
}): string {
  const failedCount = command.failedTargets.length
  const skippedCount = command.skippedTargets.length

  let summaryLine: string
  if (failedCount > 0 && skippedCount > 0) {
    summaryLine = command.t(command.keys.dashboard.syncBatch.rowIssue.mixed, {
      failed: failedCount,
      skipped: skippedCount,
    })
  } else if (failedCount > 0) {
    summaryLine = command.t(command.keys.dashboard.syncBatch.rowIssue.failedOnly, {
      failed: failedCount,
    })
  } else {
    summaryLine = command.t(command.keys.dashboard.syncBatch.rowIssue.skippedOnly, {
      skipped: skippedCount,
    })
  }

  const items = [...command.failedTargets, ...command.skippedTargets]
  const visibleLines = items.slice(0, MAX_ROW_TOOLTIP_ITEMS).map(toProblemLine)
  const remainingCount = items.length - visibleLines.length

  return [
    summaryLine,
    ...visibleLines,
    ...(remainingCount > 0
      ? [
          command.t(command.keys.dashboard.syncBatch.rowIssue.additionalItems, {
            count: remainingCount,
          }),
        ]
      : []),
  ].join('\n')
}

function toIssueByProcessId(command: {
  readonly failedTargets: readonly DashboardSyncBatchProblemTargetVM[]
  readonly skippedTargets: readonly DashboardSyncBatchProblemTargetVM[]
  readonly t: (key: string, params?: Readonly<Record<string, unknown>>) => string
  readonly keys: TranslationKeys
}): Readonly<Record<string, DashboardProcessSyncIssueVM>> {
  const processIds = new Set([
    ...command.failedTargets.map((target) => target.processId),
    ...command.skippedTargets.map((target) => target.processId),
  ])

  const issues: Record<string, DashboardProcessSyncIssueVM> = {}

  for (const processId of processIds) {
    const failedTargets = command.failedTargets.filter((target) => target.processId === processId)
    const skippedTargets = command.skippedTargets.filter((target) => target.processId === processId)

    issues[processId] = {
      severity: failedTargets.length > 0 ? 'danger' : 'warning',
      tooltip: toRowIssueTooltip({
        failedTargets,
        skippedTargets,
        t: command.t,
        keys: command.keys,
      }),
      failedCount: failedTargets.length,
      skippedCount: skippedTargets.length,
    }
  }

  return issues
}

function uniqueProcessIds(targets: readonly { readonly processId: string }[]): readonly string[] {
  return Array.from(new Set(targets.map((target) => target.processId)))
}

export function toDashboardSyncBatchResultVm(command: {
  readonly source: SyncAllProcessesRequestResult
  readonly t: (key: string, params?: Readonly<Record<string, unknown>>) => string
  readonly keys: TranslationKeys
}): DashboardSyncBatchResultVM {
  const failedTargets = command.source.payload.failedTargets.map((target) =>
    toProblemTargetVm({
      source: target,
      t: command.t,
      keys: command.keys,
    }),
  )
  const skippedTargets = command.source.payload.skippedTargets.map((target) =>
    toProblemTargetVm({
      source: target,
      t: command.t,
      keys: command.keys,
    }),
  )
  const issueByProcessId = toIssueByProcessId({
    failedTargets,
    skippedTargets,
    t: command.t,
    keys: command.keys,
  })

  let tone: DashboardSyncBatchResultVM['tone']
  if (failedTargets.length > 0) {
    tone = 'danger'
  } else if (skippedTargets.length > 0) {
    tone = 'warning'
  } else {
    tone = 'success'
  }

  return {
    httpStatus: command.source.httpStatus,
    tone,
    isBusinessError: command.source.httpStatus === 422,
    summary: {
      requestedProcesses: command.source.payload.summary.requestedProcesses,
      requestedContainers: command.source.payload.summary.requestedContainers,
      enqueued: command.source.payload.summary.enqueued,
      skipped: command.source.payload.summary.skipped,
      failed: command.source.payload.summary.failed,
    },
    enqueuedTargets: command.source.payload.enqueuedTargets.map(toEnqueuedTargetVm),
    skippedTargets,
    failedTargets,
    issueByProcessId,
    failedProcessIds: uniqueProcessIds(failedTargets),
    enqueuedProcessIds: uniqueProcessIds(command.source.payload.enqueuedTargets),
  }
}
