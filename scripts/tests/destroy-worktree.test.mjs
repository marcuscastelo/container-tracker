import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  dropLegacyWorktreeDatabaseIfPresent: vi.fn(),
  getRepoContext: vi.fn(),
  pathExists: vi.fn(),
  readWorktreeState: vi.fn(),
  runCommandCapture: vi.fn(),
  stopSupabaseProject: vi.fn(),
}))

vi.mock('../db/worktree-db.mjs', async () => {
  const actual = await vi.importActual('../db/worktree-db.mjs')

  return {
    ...actual,
    ...mocked,
  }
})

const { assertSafeToDestroy } = await import('../destroy-worktree.mjs')

describe('destroy-worktree', () => {
  beforeEach(() => {
    mocked.runCommandCapture.mockReset()
  })

  it('rejects destroying the canonical checkout', async () => {
    await expect(assertSafeToDestroy({ isWorktree: false }, { force: false })).rejects.toThrow(
      'Refusing to destroy the main checkout.',
    )
  })

  it('rejects dirty worktrees by default', async () => {
    mocked.runCommandCapture.mockResolvedValueOnce({ stdout: ' M package.json\n' })

    await expect(
      assertSafeToDestroy({ isWorktree: true, worktreePath: '/tmp/wt-a' }, { force: false }),
    ).rejects.toThrow('Worktree has local changes.')

    expect(mocked.runCommandCapture).toHaveBeenCalledWith(
      'git',
      ['-C', '/tmp/wt-a', 'status', '--porcelain', '--untracked-files=normal'],
      '/tmp/wt-a',
    )
  })

  it('allows clean worktrees', async () => {
    mocked.runCommandCapture.mockResolvedValueOnce({ stdout: '' })

    await expect(
      assertSafeToDestroy({ isWorktree: true, worktreePath: '/tmp/wt-clean' }, { force: false }),
    ).resolves.toBeUndefined()
  })

  it('skips the git preflight when force is enabled', async () => {
    await expect(
      assertSafeToDestroy({ isWorktree: true, worktreePath: '/tmp/wt-force' }, { force: true }),
    ).resolves.toBeUndefined()

    expect(mocked.runCommandCapture).not.toHaveBeenCalled()
  })
})
