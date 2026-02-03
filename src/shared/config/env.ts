/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { z } from 'zod/v4'

import { parseWithStack } from '~/shared/utils/parseWithStack'

const envSchema = z.object({
  VITE_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_PUBLIC_SUPABASE_URL: z.string().min(1),
})

const getEnvVars = (): z.input<typeof envSchema> => {
  const importMetaEnv = import.meta.env as Record<string, string | undefined>
  return Object.fromEntries(
    (Object.keys(envSchema.shape) as Array<keyof typeof envSchema.shape>).map((key) => {
      const importMetaValue = importMetaEnv[key]
      const processEnvValue = process.env[key]
      const value =
        typeof importMetaValue === 'string'
          ? importMetaValue
          : typeof processEnvValue === 'string'
            ? processEnvValue
            : undefined
      return [key, value]
    }),
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
