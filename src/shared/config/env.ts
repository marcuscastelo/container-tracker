/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { z } from 'zod/v4'

import { parseWithStack } from '~/shared/utils/parseWithStack'

const envSchema = z.object({
  VITE_NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  VITE_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  VITE_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  VITE_EXTERNAL_API_FOOD_PARAMS: z.string().min(1),
  VITE_EXTERNAL_API_REFERER: z.string().min(1),
  VITE_EXTERNAL_API_HOST: z.string().min(1),
  VITE_EXTERNAL_API_AUTHORIZATION: z.string().min(1),
  VITE_EXTERNAL_API_FOOD_ENDPOINT: z.string().min(1),
  VITE_EXTERNAL_API_EAN_ENDPOINT: z.string().min(1),
  VITE_EXTERNAL_API_BASE_URL: z.string().min(1),
  VITE_DEBUG_CWD: z.string().optional(),
  ENABLE_UNIFIED_ITEM_STRUCTURE: z
    .preprocess((v) => {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') return v === 'true'
      return false
    }, z.boolean())
    .default(false),
  VITE_RECENT_FOODS_DEFAULT_LIMIT: z
    .preprocess((v) => {
      if (typeof v === 'number') return v
      if (typeof v === 'string') return parseInt(v, 10)
      return 50
    }, z.number().min(1).max(1000))
    .default(50),
})

const getEnvVars = (): z.input<typeof envSchema> => {
  const importMetaEnv = import.meta.env as Record<string, string | undefined>
  return Object.fromEntries(
    (Object.keys(envSchema.shape) as Array<keyof typeof envSchema.shape>).map(
      (key) => {
        const importMetaValue = importMetaEnv[key]
        const processEnvValue = process.env[key]
        const value =
          typeof importMetaValue === 'string'
            ? importMetaValue
            : typeof processEnvValue === 'string'
              ? processEnvValue
              : undefined
        return [key, value]
      },
    ),
  ) as z.input<typeof envSchema>
}

const env = parseWithStack(envSchema, getEnvVars())

/**
 * Check if running in development environment
 */
export const isDevelopment = (): boolean => {
  return import.meta.env.DEV === true
}

export default env
