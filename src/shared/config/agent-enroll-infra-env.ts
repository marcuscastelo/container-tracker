type EnvRecord = Record<string, string | undefined>

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

export function resolveAgentEnrollInfraConfigFromEnv(env: EnvRecord): {
  readonly supabaseUrl: string | undefined
  readonly supabaseAnonKey: string | undefined
} {
  const supabaseUrl =
    normalizeOptionalEnv(env.AGENT_ENROLL_SUPABASE_URL) ??
    normalizeOptionalEnv(env.SUPABASE_URL) ??
    normalizeOptionalEnv(env.VITE_PUBLIC_SUPABASE_URL)

  return {
    supabaseUrl,
    // Prefer the explicit enroll key first, then the public browser key.
    // Some environments still carry a stale legacy SUPABASE_ANON_KEY that
    // no longer authorizes Realtime websocket handshakes.
    supabaseAnonKey:
      normalizeOptionalEnv(env.AGENT_ENROLL_SUPABASE_ANON_KEY) ??
      normalizeOptionalEnv(env.VITE_PUBLIC_SUPABASE_ANON_KEY) ??
      normalizeOptionalEnv(env.SUPABASE_ANON_KEY),
  }
}
