import { z } from 'zod/v4'

const NullableStringSchema = z.string().trim().min(1).nullable()

export type RawAgentEnv = {
  readonly env: NodeJS.ProcessEnv
  readonly fileValues: ReadonlyMap<string, string>
  readonly raw: string
  readonly sourcePath: string
}

export const ParsedAgentConfigSchema = z.object({
  BACKEND_URL: NullableStringSchema,
  SUPABASE_URL: NullableStringSchema,
  SUPABASE_ANON_KEY: NullableStringSchema,
  AGENT_TOKEN: NullableStringSchema,
  INSTALLER_TOKEN: NullableStringSchema,
  TENANT_ID: NullableStringSchema,
  AGENT_ID: NullableStringSchema,
  INTERVAL_SEC: z.number().int().positive().nullable(),
  LIMIT: z.number().int().min(1).max(100).nullable(),
  MAERSK_ENABLED: z.boolean(),
  MAERSK_HEADLESS: z.boolean(),
  MAERSK_TIMEOUT_MS: z.number().int().positive().nullable(),
  MAERSK_USER_DATA_DIR: NullableStringSchema,
  AGENT_UPDATE_MANIFEST_CHANNEL: NullableStringSchema,
})

export type ParsedAgentConfig = z.infer<typeof ParsedAgentConfigSchema>

export const ValidatedAgentConfigSchema = z.object({
  BACKEND_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/u, '')),
  SUPABASE_URL: z.string().url().nullable(),
  SUPABASE_ANON_KEY: z.string().min(1).nullable(),
  AGENT_TOKEN: z.string().min(1),
  TENANT_ID: z.string().uuid(),
  AGENT_ID: z.string().min(1),
  INTERVAL_SEC: z.number().int().positive(),
  LIMIT: z.number().int().min(1).max(100),
  MAERSK_ENABLED: z.boolean(),
  MAERSK_HEADLESS: z.boolean(),
  MAERSK_TIMEOUT_MS: z.number().int().positive(),
  MAERSK_USER_DATA_DIR: z.string().min(1).nullable(),
  AGENT_UPDATE_MANIFEST_CHANNEL: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase()),
})

export type ValidatedAgentConfig = z.infer<typeof ValidatedAgentConfigSchema>

export const ValidatedBootstrapConfigSchema = z.object({
  BACKEND_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/u, '')),
  INSTALLER_TOKEN: z.string().min(1),
  AGENT_ID: z.string().min(1),
  INTERVAL_SEC: z.number().int().positive(),
  LIMIT: z.number().int().min(1).max(100),
  MAERSK_ENABLED: z.boolean(),
  MAERSK_HEADLESS: z.boolean(),
  MAERSK_TIMEOUT_MS: z.number().int().positive(),
  MAERSK_USER_DATA_DIR: z.string().min(1).nullable(),
  AGENT_UPDATE_MANIFEST_CHANNEL: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase()),
})

export type ValidatedBootstrapConfig = z.infer<typeof ValidatedBootstrapConfigSchema>
