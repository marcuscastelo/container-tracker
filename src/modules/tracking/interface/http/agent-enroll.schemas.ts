import { z } from 'zod/v4'

export const AgentEnrollRequestSchema = z.object({
  machineFingerprint: z.string().min(8).max(256),
  hostname: z.string().min(1).max(255),
  os: z.string().min(1).max(128),
  agentVersion: z.string().min(1).max(128),
})
export type AgentEnrollRequest = z.infer<typeof AgentEnrollRequestSchema>

export const AgentEnrollProvidersSchema = z.object({
  maerskEnabled: z.boolean(),
  maerskHeadless: z.boolean(),
  maerskTimeoutMs: z.number().int().positive(),
  maerskUserDataDir: z.string().min(1).optional(),
})
export type AgentEnrollProviders = z.infer<typeof AgentEnrollProvidersSchema>

export const AgentEnrollResponseSchema = z.object({
  agentToken: z.string().min(1),
  tenantId: z.string().uuid(),
  intervalSec: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
  providers: AgentEnrollProvidersSchema,
})
export type AgentEnrollResponse = z.infer<typeof AgentEnrollResponseSchema>
