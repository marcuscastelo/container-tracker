import { describe, expect, it } from 'vitest'

import { resolveAgentEnrollInfraConfigFromEnv } from '~/shared/config/agent-enroll-infra-env'

describe('resolveAgentEnrollInfraConfigFromEnv', () => {
  it('prefers explicit agent-enroll infra values', () => {
    const resolved = resolveAgentEnrollInfraConfigFromEnv({
      AGENT_ENROLL_SUPABASE_URL: 'https://agent-enroll.supabase.test',
      AGENT_ENROLL_SUPABASE_ANON_KEY: 'agent-enroll-anon',
      SUPABASE_URL: 'https://legacy.supabase.test',
      SUPABASE_ANON_KEY: 'legacy-anon',
      VITE_PUBLIC_SUPABASE_URL: 'https://public.supabase.test',
      VITE_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
    })

    expect(resolved).toEqual({
      supabaseUrl: 'https://agent-enroll.supabase.test',
      supabaseAnonKey: 'agent-enroll-anon',
    })
  })

  it('prefers the public browser anon key over the legacy server anon key fallback', () => {
    const resolved = resolveAgentEnrollInfraConfigFromEnv({
      SUPABASE_URL: 'https://legacy.supabase.test',
      SUPABASE_ANON_KEY: 'legacy-anon',
      VITE_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
    })

    expect(resolved).toEqual({
      supabaseUrl: 'https://legacy.supabase.test',
      supabaseAnonKey: 'public-anon',
    })
  })

  it('falls back to legacy values when no enroll/public override exists', () => {
    const resolved = resolveAgentEnrollInfraConfigFromEnv({
      SUPABASE_URL: 'https://legacy.supabase.test',
      SUPABASE_ANON_KEY: 'legacy-anon',
    })

    expect(resolved).toEqual({
      supabaseUrl: 'https://legacy.supabase.test',
      supabaseAnonKey: 'legacy-anon',
    })
  })
})
