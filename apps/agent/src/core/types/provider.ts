import { z } from 'zod/v4'

export const AgentProviderSchema = z.enum(['maersk', 'msc', 'cmacgm', 'pil', 'one'])

export type AgentProvider = z.infer<typeof AgentProviderSchema>
