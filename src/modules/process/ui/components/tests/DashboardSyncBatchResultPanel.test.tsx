import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { DashboardSyncBatchResultPanel } from '~/modules/process/ui/components/DashboardSyncBatchResultPanel'
import type {
  DashboardSyncBatchProblemTargetVM,
  DashboardSyncBatchResultVM,
} from '~/modules/process/ui/viewmodels/dashboard-sync-batch-result.vm'

const translationKeys = vi.hoisted(() => ({
  dashboard: {
    syncBatch: {
      panel: {
        title: 'Sync batch result',
        subtitle: 'Server-first reconciliation summary',
        headlineSuccess: 'All eligible targets were enqueued',
        headlinePartial: 'Partial sync result',
        headlineNoEnqueue: 'No targets were enqueued',
        dismiss: 'Dismiss',
        showAll: 'Show all ({count})',
        showLess: 'Show less',
        sections: {
          failed: 'Failed targets',
          skipped: 'Skipped targets',
        },
        summary: {
          requestedProcesses: 'Requested processes: {count}',
          requestedContainers: 'Requested containers: {count}',
          enqueued: 'Enqueued: {count}',
          skipped: 'Skipped: {count}',
          failed: 'Failed: {count}',
        },
      },
    },
  },
}))

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    keys: translationKeys,
    t: (value: string, params?: Readonly<Record<string, unknown>>) => {
      if (params === undefined) {
        return value
      }

      let translated = value
      for (const [key, paramValue] of Object.entries(params)) {
        translated = translated.replace(`{${key}}`, String(paramValue))
      }
      return translated
    },
  }),
}))

function buildProblemTarget(command: {
  readonly processId: string
  readonly processLabel: string
  readonly containerNumber: string
  readonly providerLabel: string
  readonly reasonLabel: string
  readonly reasonMessage: string
}): DashboardSyncBatchProblemTargetVM {
  return {
    processId: command.processId,
    processReference: command.processLabel,
    processLabel: command.processLabel,
    containerNumber: command.containerNumber,
    provider: command.providerLabel.toLowerCase(),
    providerLabel: command.providerLabel,
    reasonCode: 'UNSUPPORTED_PROVIDER',
    reasonLabel: command.reasonLabel,
    reasonMessage: command.reasonMessage,
  }
}

function buildResult(command?: {
  readonly tone?: DashboardSyncBatchResultVM['tone']
  readonly isBusinessError?: boolean
  readonly httpStatus?: DashboardSyncBatchResultVM['httpStatus']
}): DashboardSyncBatchResultVM {
  const failedTargets = [
    buildProblemTarget({
      processId: 'process-1',
      processLabel: 'REF-1',
      containerNumber: 'FAILED-000001',
      providerLabel: 'Maersk',
      reasonLabel: 'Failed reason 1',
      reasonMessage: 'Failed message 1',
    }),
    buildProblemTarget({
      processId: 'process-2',
      processLabel: 'REF-2',
      containerNumber: 'FAILED-000002',
      providerLabel: 'Maersk',
      reasonLabel: 'Failed reason 2',
      reasonMessage: 'Failed message 2',
    }),
    buildProblemTarget({
      processId: 'process-3',
      processLabel: 'REF-3',
      containerNumber: 'FAILED-000003',
      providerLabel: 'MSC',
      reasonLabel: 'Failed reason 3',
      reasonMessage: 'Failed message 3',
    }),
    buildProblemTarget({
      processId: 'process-4',
      processLabel: 'REF-4',
      containerNumber: 'FAILED-000004',
      providerLabel: 'MSC',
      reasonLabel: 'Failed reason 4',
      reasonMessage: 'Failed message 4',
    }),
    buildProblemTarget({
      processId: 'process-5',
      processLabel: 'REF-5',
      containerNumber: 'FAILED-000005',
      providerLabel: 'Hapag',
      reasonLabel: 'Failed reason 5',
      reasonMessage: 'Failed message 5',
    }),
    buildProblemTarget({
      processId: 'process-6',
      processLabel: 'REF-6',
      containerNumber: 'FAILED-000006',
      providerLabel: 'Hapag',
      reasonLabel: 'Failed reason 6',
      reasonMessage: 'Failed message 6',
    }),
  ]

  const skippedTargets = [
    buildProblemTarget({
      processId: 'process-7',
      processLabel: 'REF-7',
      containerNumber: 'SKIPPED-000001',
      providerLabel: 'Hapag',
      reasonLabel: 'Skipped reason 1',
      reasonMessage: 'Skipped message 1',
    }),
    buildProblemTarget({
      processId: 'process-8',
      processLabel: 'REF-8',
      containerNumber: 'SKIPPED-000002',
      providerLabel: 'Hapag',
      reasonLabel: 'Skipped reason 2',
      reasonMessage: 'Skipped message 2',
    }),
    buildProblemTarget({
      processId: 'process-9',
      processLabel: 'REF-9',
      containerNumber: 'SKIPPED-000003',
      providerLabel: 'MSC',
      reasonLabel: 'Skipped reason 3',
      reasonMessage: 'Skipped message 3',
    }),
    buildProblemTarget({
      processId: 'process-10',
      processLabel: 'REF-10',
      containerNumber: 'SKIPPED-000004',
      providerLabel: 'MSC',
      reasonLabel: 'Skipped reason 4',
      reasonMessage: 'Skipped message 4',
    }),
    buildProblemTarget({
      processId: 'process-11',
      processLabel: 'REF-11',
      containerNumber: 'SKIPPED-000005',
      providerLabel: 'ONE',
      reasonLabel: 'Skipped reason 5',
      reasonMessage: 'Skipped message 5',
    }),
    buildProblemTarget({
      processId: 'process-12',
      processLabel: 'REF-12',
      containerNumber: 'SKIPPED-000006',
      providerLabel: 'ONE',
      reasonLabel: 'Skipped reason 6',
      reasonMessage: 'Skipped message 6',
    }),
  ]

  return {
    httpStatus: command?.httpStatus ?? 200,
    tone: command?.tone ?? 'danger',
    isBusinessError: command?.isBusinessError ?? false,
    summary: {
      requestedProcesses: 12,
      requestedContainers: 14,
      enqueued: 2,
      skipped: skippedTargets.length,
      failed: failedTargets.length,
    },
    enqueuedTargets: [
      {
        processId: 'process-13',
        processReference: 'REF-13',
        processLabel: 'REF-13',
        containerNumber: 'ENQUEUED-000001',
        provider: 'maersk',
        providerLabel: 'Maersk',
        syncRequestId: 'sync-request-1',
      },
      {
        processId: 'process-14',
        processReference: 'REF-14',
        processLabel: 'REF-14',
        containerNumber: 'ENQUEUED-000002',
        provider: 'msc',
        providerLabel: 'MSC',
        syncRequestId: 'sync-request-2',
      },
    ],
    skippedTargets,
    failedTargets,
    issueByProcessId: {},
    failedProcessIds: failedTargets.map((target) => target.processId),
    enqueuedProcessIds: ['process-13', 'process-14'],
  }
}

describe('DashboardSyncBatchResultPanel', () => {
  it('renders summary chips, failed section first, and only the first five items per section by default', () => {
    const html = renderToString(() =>
      createComponent(DashboardSyncBatchResultPanel, {
        result: buildResult(),
        onDismiss: vi.fn(),
      }),
    )

    expect(html).toContain('Sync batch result')
    expect(html).toContain('Partial sync result')
    expect(html).toContain('Requested processes: 12')
    expect(html).toContain('Requested containers: 14')
    expect(html).toContain('Enqueued: 2')
    expect(html).toContain('Skipped: 6')
    expect(html).toContain('Failed: 6')
    expect(html.indexOf('Failed targets')).toBeLessThan(html.indexOf('Skipped targets'))
    expect(html).toContain('FAILED-000005')
    expect(html).not.toContain('FAILED-000006')
    expect(html).toContain('SKIPPED-000005')
    expect(html).not.toContain('SKIPPED-000006')
    expect(html.split('Show all (1)').length - 1).toBe(2)
  })

  it('renders the business-error headline when no target was enqueued', () => {
    const html = renderToString(() =>
      createComponent(DashboardSyncBatchResultPanel, {
        result: buildResult({
          httpStatus: 422,
          isBusinessError: true,
          tone: 'danger',
        }),
        onDismiss: vi.fn(),
      }),
    )

    expect(html).toContain('No targets were enqueued')
    expect(html).toContain('Dismiss')
  })
})
