import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_REFRESH_COOLDOWN_MS,
  isDashboardRefreshBlocked,
  toDashboardRefreshCooldownUntilMs,
} from '~/modules/process/ui/utils/dashboard-refresh-button'

describe('DashboardRefreshButton cooldown rules', () => {
  it('builds cooldown end timestamp from click start timestamp', () => {
    expect(toDashboardRefreshCooldownUntilMs(1_000)).toBe(1_000 + DASHBOARD_REFRESH_COOLDOWN_MS)
  })

  it('keeps button blocked while loading even if cooldown already elapsed', () => {
    expect(
      isDashboardRefreshBlocked({
        isLoading: true,
        cooldownUntilMs: 1_000,
        nowMs: 5_000,
      }),
    ).toBe(true)
  })

  it('keeps button blocked while cooldown has not elapsed after loading finished', () => {
    const clickStartedAtMs = 10_000
    const cooldownUntilMs = toDashboardRefreshCooldownUntilMs(clickStartedAtMs)

    expect(
      isDashboardRefreshBlocked({
        isLoading: false,
        cooldownUntilMs,
        nowMs: clickStartedAtMs + 1_500,
      }),
    ).toBe(true)
  })

  it('unblocks button when loading ended and cooldown elapsed', () => {
    const clickStartedAtMs = 20_000
    const cooldownUntilMs = toDashboardRefreshCooldownUntilMs(clickStartedAtMs)

    expect(
      isDashboardRefreshBlocked({
        isLoading: false,
        cooldownUntilMs,
        nowMs: clickStartedAtMs + 2_000,
      }),
    ).toBe(false)
  })
})
