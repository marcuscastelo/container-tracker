import { describe, expect, it } from 'vitest'
import { resolveProcessSyncVisualState } from '~/modules/process/ui/components/ProcessSyncButton'

describe('ProcessSyncButton state resolver', () => {
  it('forces syncing while request is in progress regardless of server status', () => {
    expect(
      resolveProcessSyncVisualState({
        statusFromServer: 'error',
        isSubmitting: true,
        localFeedback: null,
      }),
    ).toBe('syncing')
  })

  it('prefers non-idle server status when there is no local in-flight request', () => {
    expect(
      resolveProcessSyncVisualState({
        statusFromServer: 'success',
        isSubmitting: false,
        localFeedback: 'error',
      }),
    ).toBe('success')
  })

  it('uses local feedback when server status is idle', () => {
    expect(
      resolveProcessSyncVisualState({
        statusFromServer: 'idle',
        isSubmitting: false,
        localFeedback: 'error',
      }),
    ).toBe('error')
    expect(
      resolveProcessSyncVisualState({
        statusFromServer: 'idle',
        isSubmitting: false,
        localFeedback: 'success',
      }),
    ).toBe('success')
  })

  it('keeps idle when there is no server status override and no local feedback', () => {
    expect(
      resolveProcessSyncVisualState({
        statusFromServer: 'idle',
        isSubmitting: false,
        localFeedback: null,
      }),
    ).toBe('idle')
  })
})
