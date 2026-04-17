import { describe, expect, it } from 'vitest'

import {
  buildDevProjectId,
  buildPortMap,
  buildStageProjectId,
  buildWorktreeId,
  LEGACY_WORKTREE_MANAGED_BLOCK_END,
  LEGACY_WORKTREE_MANAGED_BLOCK_START,
  parseSupabaseStatusEnvOutput,
  sanitizeIdentifierSegment,
  stripManagedEnvAssignments,
  upsertManagedEnvBlock,
  WORKTREE_MANAGED_BLOCK_END,
  WORKTREE_MANAGED_BLOCK_START,
} from '../db/worktree-db.mjs'

function buildState(mode = 'staging') {
  const stageEnvMap = {
    API_URL: 'http://127.0.0.1:54321',
    DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    ANON_KEY: 'stage-anon',
    SERVICE_ROLE_KEY: 'stage-service',
    PUBLISHABLE_KEY: 'stage-publishable',
    SECRET_KEY: 'stage-secret',
    JWT_SECRET: 'stage-jwt',
  }
  const emancipatedEnvMap = {
    API_URL: 'http://127.0.0.1:62581',
    DB_URL: 'postgresql://postgres:postgres@127.0.0.1:62582/postgres',
    ANON_KEY: 'dev-anon',
    SERVICE_ROLE_KEY: 'dev-service',
    PUBLISHABLE_KEY: 'dev-publishable',
    SECRET_KEY: 'dev-secret',
    JWT_SECRET: 'dev-jwt',
  }

  return {
    mode,
    worktreeId: 'wt_feature_abcd1234',
    staging: {
      projectId: 'ct_stage_deadbeef',
      envMap: stageEnvMap,
    },
    emancipated: {
      projectId: 'ct_dev_wt_feature_abcd1234',
      envMap: emancipatedEnvMap,
    },
  }
}

describe('worktree-db', () => {
  it('sanitizes identifier segments', () => {
    expect(sanitizeIdentifierSegment('Minha-Worktree Ç/Teste 123')).toBe(
      'minha_worktree_c_teste_123',
    )
    expect(sanitizeIdentifierSegment('___')).toBe('')
  })

  it('builds deterministic worktree and project ids', () => {
    const first = buildWorktreeId('/tmp/WT-Feature-A')
    const second = buildWorktreeId('/tmp/WT-Feature-A')
    const third = buildWorktreeId('/tmp/WT-Feature-B')

    expect(first).toBe(second)
    expect(first).not.toBe(third)
    expect(first.startsWith('wt_feature_a_')).toBe(true)
    expect(buildStageProjectId('/tmp/repo')).toMatch(/^ct_stage_[a-f0-9]{8}$/)
    expect(buildDevProjectId('wt_feature_a_deadbeef')).toBe('ct_dev_wt_feature_a_deadbeef')
  })

  it('builds the expected deterministic port block', () => {
    expect(buildPortMap(40000)).toEqual({
      shadow: 40000,
      api: 40001,
      db: 40002,
      studio: 40003,
      inbucket: 40004,
      analytics: 40007,
      pooler: 40009,
    })
  })

  it('upserts the managed environment block idempotently', () => {
    const base = [
      'SYNC_DEFAULT_TENANT_ID="tenant"',
      'SUPABASE_URL="stale"',
      'LOCAL_DB_URL="stale"',
      '',
    ].join('\n')

    const first = upsertManagedEnvBlock(base, buildState())

    expect(first.includes(WORKTREE_MANAGED_BLOCK_START)).toBe(true)
    expect(first.includes(WORKTREE_MANAGED_BLOCK_END)).toBe(true)
    expect(first.includes('CT_WORKTREE_ENV_MODE="staging"')).toBe(true)
    expect(first.includes('CT_SUPABASE_PROJECT_ID="ct_stage_deadbeef"')).toBe(true)
    expect(first.includes('SUPABASE_URL="http://127.0.0.1:54321"')).toBe(true)
    expect(first.match(/^SUPABASE_URL=/gm)?.length ?? 0).toBe(1)
    expect(first.match(/^LOCAL_DB_URL=/gm)?.length ?? 0).toBe(1)

    const second = upsertManagedEnvBlock(first, buildState())
    expect(second).toBe(first)
  })

  it('replaces the legacy db-only marker block with the new env block', () => {
    const legacy = [
      'SYNC_DEFAULT_TENANT_ID="tenant"',
      LEGACY_WORKTREE_MANAGED_BLOCK_START,
      'POSTGRES_DATABASE="ct_wt_old"',
      'LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/ct_wt_old"',
      LEGACY_WORKTREE_MANAGED_BLOCK_END,
      '',
    ].join('\n')

    const updated = upsertManagedEnvBlock(legacy, buildState('emancipated'))

    expect(updated.includes(LEGACY_WORKTREE_MANAGED_BLOCK_START)).toBe(false)
    expect(updated.includes(LEGACY_WORKTREE_MANAGED_BLOCK_END)).toBe(false)
    expect(updated.includes(WORKTREE_MANAGED_BLOCK_START)).toBe(true)
    expect(updated.includes('CT_WORKTREE_ENV_MODE="emancipated"')).toBe(true)
    expect(updated.includes('CT_SUPABASE_PROJECT_ID="ct_dev_wt_feature_abcd1234"')).toBe(true)
    expect(updated.includes('SUPABASE_URL="http://127.0.0.1:62581"')).toBe(true)
  })

  it('fails when the managed block markers are duplicated', () => {
    const duplicated = [
      WORKTREE_MANAGED_BLOCK_START,
      'CT_WORKTREE_ENV_MODE="staging"',
      WORKTREE_MANAGED_BLOCK_END,
      WORKTREE_MANAGED_BLOCK_START,
      'CT_WORKTREE_ENV_MODE="emancipated"',
      WORKTREE_MANAGED_BLOCK_END,
    ].join('\n')

    expect(() => upsertManagedEnvBlock(duplicated, buildState())).toThrow(
      'Managed environment block appears multiple times in .env.',
    )
  })

  it('strips managed assignments outside the block and preserves unrelated lines', () => {
    const sanitized = stripManagedEnvAssignments(
      [
        'SYNC_DEFAULT_TENANT_ID="tenant"',
        'SUPABASE_URL="stale"',
        'LOCAL_DB_URL="stale"',
        'AGENT_UPDATE_MANIFEST_CHANNEL=disabled',
      ].join('\n'),
    )

    expect(sanitized).toContain('SYNC_DEFAULT_TENANT_ID="tenant"')
    expect(sanitized).toContain('AGENT_UPDATE_MANIFEST_CHANNEL=disabled')
    expect(sanitized).not.toContain('SUPABASE_URL="stale"')
    expect(sanitized).not.toContain('LOCAL_DB_URL="stale"')
  })

  it('parses supabase status env output with noise lines', () => {
    const output = [
      'Stopped services: [supabase_storage_demo supabase_pooler_demo]',
      'ANON_KEY="test-anon"',
      'API_URL="http://127.0.0.1:54321"',
      'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
      '',
    ].join('\n')

    expect(parseSupabaseStatusEnvOutput(output)).toEqual({
      ANON_KEY: 'test-anon',
      API_URL: 'http://127.0.0.1:54321',
      DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    })
  })
})
