/**
 * Source of the process data.
 */
export type ProcessSource = 'manual' | 'api' | 'import'
export const PROCESS_SOURCES: readonly ProcessSource[] = ['manual', 'api', 'import']

/**
 * Carrier enum (extensible).
 * Add new carriers here as they are integrated.
 */
export type Carrier = 'maersk' | 'msc' | 'cmacgm' | 'hapag' | 'one' | 'evergreen' | 'unknown'
export const CARRIERS: readonly Carrier[] = [
  'maersk',
  'msc',
  'cmacgm',
  'hapag',
  'one',
  'evergreen',
  'unknown',
]
