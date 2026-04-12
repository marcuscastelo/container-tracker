import { createComponent } from 'solid-js'
import { renderToString } from 'solid-js/web'
import { describe, expect, it, vi } from 'vitest'
import { SyncCell } from '~/modules/process/ui/components/SyncCell'
import type { DashboardProcessSyncIssueVM } from '~/modules/process/ui/viewmodels/dashboard-sync-batch-result.vm'

const translationKeys = vi.hoisted(() => ({
  dashboard: {
    table: {
      sync: {
        idle: 'Sync idle',
        syncing: 'Sync running',
        successRecent: 'Sync succeeded',
        failed: 'Sync failed',
        disabled: 'Sync unavailable',
      },
    },
  },
}))

vi.mock('~/shared/localization/i18n', () => ({
  useTranslation: () => ({
    keys: translationKeys,
    t: (value: string) => value,
  }),
}))

function buildIssue(severity: DashboardProcessSyncIssueVM['severity']): DashboardProcessSyncIssueVM {
  return {
    severity,
    tooltip:
      severity === 'danger'
        ? '1 failed\nMSCU1234567 · Maersk · Enqueue failed'
        : '1 skipped\nMSCU1234567 · Hapag · Unsupported provider',
    failedCount: severity === 'danger' ? 1 : 0,
    skippedCount: severity === 'warning' ? 1 : 0,
  }
}

describe('SyncCell', () => {
  it('merges the persistent row issue tooltip with the idle sync label', () => {
    const html = renderToString(() =>
      createComponent(SyncCell, {
        state: 'idle',
        issue: buildIssue('warning'),
        onSync: vi.fn(),
      }),
    )

    expect(html).toContain('Sync idle')
    expect(html).toContain('1 skipped')
    expect(html).toContain('Unsupported provider')
    expect(html).toContain('absolute -right-1 -top-1')
    expect(html).not.toContain('disabled')
  })

  it('keeps failed state non-interactive while still exposing the row issue marker', () => {
    const html = renderToString(() =>
      createComponent(SyncCell, {
        state: 'failed',
        issue: buildIssue('danger'),
      }),
    )

    expect(html).toContain('Sync failed')
    expect(html).toContain('1 failed')
    expect(html).toContain('Enqueue failed')
    expect(html).toContain('disabled')
    expect(html).toContain('cursor-default')
    expect(html).toContain('border-tone-danger-border')
  })
})
