import { z } from 'zod/v4'

import { parseWithStack } from '~/shared/utils/parseWithStack'

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  if (normalized.length === 0) return undefined
  return normalized
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  const normalized = normalizeOptionalEnv(value)?.toLowerCase()
  if (!normalized) return fallback

  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  return fallback
}

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SYNC_DEFAULT_TENANT_ID: z.string().uuid(),
  AGENT_TOKEN: z.string().min(1).optional(),
  AGENT_LEASE_MINUTES: z.coerce.number().int().positive().default(5),
  AGENT_ENROLL_DEFAULT_INTERVAL_SEC: z.coerce.number().int().positive().default(60),
  AGENT_ENROLL_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  AGENT_ENROLL_SUPABASE_URL: z.string().url().optional(),
  AGENT_ENROLL_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  AGENT_ENROLL_DEFAULT_MAERSK_ENABLED: z.boolean().default(false),
  AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS: z.boolean().default(true),
  AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR: z.string().min(1).optional(),
  AGENT_ENROLL_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(20),
  AGENT_ENROLL_RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(60),
  NODE_ENV: z.string().optional(),
})

const getServerEnvVars = (): unknown => {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SYNC_DEFAULT_TENANT_ID: process.env.SYNC_DEFAULT_TENANT_ID,
    AGENT_TOKEN: normalizeOptionalEnv(process.env.AGENT_TOKEN),
    AGENT_LEASE_MINUTES: process.env.AGENT_LEASE_MINUTES,
    AGENT_ENROLL_DEFAULT_INTERVAL_SEC: process.env.AGENT_ENROLL_DEFAULT_INTERVAL_SEC,
    AGENT_ENROLL_DEFAULT_LIMIT: process.env.AGENT_ENROLL_DEFAULT_LIMIT,
    AGENT_ENROLL_SUPABASE_URL: normalizeOptionalEnv(process.env.AGENT_ENROLL_SUPABASE_URL),
    AGENT_ENROLL_SUPABASE_ANON_KEY: normalizeOptionalEnv(
      process.env.AGENT_ENROLL_SUPABASE_ANON_KEY,
    ),
    AGENT_ENROLL_DEFAULT_MAERSK_ENABLED: parseBooleanEnv(
      process.env.AGENT_ENROLL_DEFAULT_MAERSK_ENABLED,
      false,
    ),
    AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS: parseBooleanEnv(
      process.env.AGENT_ENROLL_DEFAULT_MAERSK_HEADLESS,
      true,
    ),
    AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS: process.env.AGENT_ENROLL_DEFAULT_MAERSK_TIMEOUT_MS,
    AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR: normalizeOptionalEnv(
      process.env.AGENT_ENROLL_DEFAULT_MAERSK_USER_DATA_DIR,
    ),
    AGENT_ENROLL_RATE_LIMIT_MAX_REQUESTS: process.env.AGENT_ENROLL_RATE_LIMIT_MAX_REQUESTS,
    AGENT_ENROLL_RATE_LIMIT_WINDOW_SEC: process.env.AGENT_ENROLL_RATE_LIMIT_WINDOW_SEC,
    NODE_ENV: process.env.NODE_ENV,
  }
}

const parsedServerEnv = parseWithStack(serverEnvSchema, getServerEnvVars())

export const serverEnv = {
  ...parsedServerEnv,
  AGENT_TOKEN: parsedServerEnv.AGENT_TOKEN ?? null,
}
