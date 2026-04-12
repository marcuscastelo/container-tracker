import { describe, expect, it } from 'vitest'

import {
  buildWorktreeDatabaseName,
  parseSupabaseStatusEnvOutput,
  sanitizeIdentifierSegment,
  upsertManagedDbEnvBlock,
  WORKTREE_DATABASE_PREFIX,
  WORKTREE_MANAGED_BLOCK_END,
  WORKTREE_MANAGED_BLOCK_START,
} from '../db/worktree-db.mjs'

describe('worktree-db', () => {
  it('sanitizes identifier segments for postgres database names', () => {
    expect(sanitizeIdentifierSegment('Minha-Worktree Ç/Teste 123')).toBe(
      'minha_worktree_c_teste_123',
    )
    expect(sanitizeIdentifierSegment('___')).toBe('')
  })

  it('builds deterministic database names with max length 63', () => {
    const first = buildWorktreeDatabaseName('/tmp/WT-Feature-A')
    const second = buildWorktreeDatabaseName('/tmp/WT-Feature-A')
    const third = buildWorktreeDatabaseName('/tmp/WT-Feature-B')

    expect(first).toBe(second)
    expect(first).not.toBe(third)
    expect(first.startsWith(WORKTREE_DATABASE_PREFIX)).toBe(true)
    expect(first.length).toBeLessThanOrEqual(63)
  })

  it('upserts managed env block and keeps operation idempotent', () => {
    const base = [
      'SUPABASE_URL="http://127.0.0.1:54321"',
      'SYNC_DEFAULT_TENANT_ID="tenant"',
      '',
    ].join('\n')

    const first = upsertManagedDbEnvBlock(base, {
      databaseName: 'ct_wt_feature_abcd1234',
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/ct_wt_feature_abcd1234',
    })

    expect(first.includes(WORKTREE_MANAGED_BLOCK_START)).toBe(true)
    expect(first.includes(WORKTREE_MANAGED_BLOCK_END)).toBe(true)
    expect(first.includes('POSTGRES_DATABASE="ct_wt_feature_abcd1234"')).toBe(true)

    const second = upsertManagedDbEnvBlock(first, {
      databaseName: 'ct_wt_feature_abcd1234',
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/ct_wt_feature_abcd1234',
    })

    expect(second).toBe(first)
  })

  it('replaces existing managed block instead of duplicating it', () => {
    const base = ['A=1', 'B=2', ''].join('\n')

    const first = upsertManagedDbEnvBlock(base, {
      databaseName: 'ct_wt_one_aaaaaaaa',
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/ct_wt_one_aaaaaaaa',
    })

    const second = upsertManagedDbEnvBlock(first, {
      databaseName: 'ct_wt_two_bbbbbbbb',
      databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/ct_wt_two_bbbbbbbb',
    })

    expect(second.includes('ct_wt_one_aaaaaaaa')).toBe(false)
    expect(second.includes('ct_wt_two_bbbbbbbb')).toBe(true)
    expect(second.split(WORKTREE_MANAGED_BLOCK_START).length - 1).toBe(1)
    expect(second.split(WORKTREE_MANAGED_BLOCK_END).length - 1).toBe(1)
  })

  it('fails when managed block markers are duplicated', () => {
    const duplicated = [
      WORKTREE_MANAGED_BLOCK_START,
      'POSTGRES_DATABASE="a"',
      WORKTREE_MANAGED_BLOCK_END,
      WORKTREE_MANAGED_BLOCK_START,
      'POSTGRES_DATABASE="b"',
      WORKTREE_MANAGED_BLOCK_END,
    ].join('\n')

    expect(() =>
      upsertManagedDbEnvBlock(duplicated, {
        databaseName: 'ct_wt_feature_cccccccc',
        databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/ct_wt_feature_cccccccc',
      }),
    ).toThrow('Managed DB block appears multiple times in .env.')
  })

  it('parses supabase status env output with noise lines', () => {
    const output = [
      'Stopped services: [supabase_storage_demo supabase_pooler_demo]',
      'ANON_KEY="test-anon"',
      'API_URL="http://127.0.0.1:54321"',
      'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
      '',
    ].join('\n')

    const parsed = parseSupabaseStatusEnvOutput(output)

    expect(parsed.ANON_KEY).toBe('test-anon')
    expect(parsed.API_URL).toBe('http://127.0.0.1:54321')
    expect(parsed.DB_URL).toBe('postgresql://postgres:postgres@127.0.0.1:54322/postgres')
  })
})
