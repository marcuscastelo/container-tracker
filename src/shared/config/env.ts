import { z } from 'zod/v4'

import { parseWithStack } from '~/shared/utils/parseWithStack'

const envSchema = z.object({
  VITE_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_PUBLIC_SUPABASE_URL: z.string().min(1),
})

const getEnvVars = (): z.input<typeof envSchema> => {
  const importMetaEnv = import.meta.env
  // @ts-expect-error: Forced typing
  return Object.fromEntries(
    Object.keys(envSchema.shape).map((key) => {
      const importMetaValue = importMetaEnv[key]
      const processEnvValue = process.env[key]
      let value: string | undefined
      if (typeof importMetaValue === 'string') {
        value = importMetaValue
      } else if (typeof processEnvValue === 'string') {
        value = processEnvValue
      } else {
        value = undefined
      }
      return [key, value]
    }),
  )
}

export const env = parseWithStack(envSchema, getEnvVars())
