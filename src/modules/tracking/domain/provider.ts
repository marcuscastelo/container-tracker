import z from 'zod/v4'

/**
 * Supported carrier/provider identifiers.
 * Extensible — add new carriers here as they are integrated.
 */
export const ProviderSchema = z.enum(['msc', 'maersk', 'cmacgm', 'hapag', 'one', 'evergreen'])
export type Provider = z.infer<typeof ProviderSchema>
