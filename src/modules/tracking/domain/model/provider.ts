/**
 * Supported carrier/provider identifiers.
 * Extensible — add new carriers here as they are integrated.
 */
export type Provider = 'msc' | 'maersk' | 'cmacgm'
export const PROVIDERS: readonly Provider[] = ['msc', 'maersk', 'cmacgm']
