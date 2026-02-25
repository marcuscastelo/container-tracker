import { z } from 'zod/v4'

import { parseWithStack } from '~/shared/utils/parseWithStack'

const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SYNC_DEFAULT_TENANT_ID: z.string().uuid(),
  AGENT_TOKEN: z.string().min(1).optional(),
  AGENT_LEASE_MINUTES: z.coerce.number().int().positive().default(5),
  NODE_ENV: z.string().optional(),
})

const getServerEnvVars = (): unknown => {
  return {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SYNC_DEFAULT_TENANT_ID: process.env.SYNC_DEFAULT_TENANT_ID,
    AGENT_TOKEN: process.env.AGENT_TOKEN,
    AGENT_LEASE_MINUTES: process.env.AGENT_LEASE_MINUTES,
    NODE_ENV: process.env.NODE_ENV,
  }
}

const parsedServerEnv = parseWithStack(serverEnvSchema, getServerEnvVars())

export const serverEnv = {
  ...parsedServerEnv,
  AGENT_TOKEN: parsedServerEnv.AGENT_TOKEN ?? null,
}
