import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestOperationalReportExportText } from '~/modules/process/ui/api/export-import.api'

describe('requestOperationalReportExportText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('posts a trello export request and returns markdown text', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('# CA064-25\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      }),
    )

    const result = await requestOperationalReportExportText({
      scope: {
        scope: 'single_process',
        processId: 'process-1',
      },
      format: 'trello',
      options: {
        includeContainers: true,
        includeAlerts: true,
        includeTimelineSummary: true,
        includeExecutiveSummary: true,
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith('/api/export-import/report/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: 'single_process',
        processId: 'process-1',
        format: 'trello',
        includeContainers: true,
        includeAlerts: true,
        includeTimelineSummary: true,
        includeExecutiveSummary: true,
      }),
    })
    expect(result).toBe('# CA064-25\n')
  })
})
