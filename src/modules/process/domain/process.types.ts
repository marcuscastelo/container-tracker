export type ProcessBrand<K, T> = K & {
  readonly __brand: T
  readonly __brandContext: 'ProcessModule'
}

export function toProcessBrand<K, T>(value: K): ProcessBrand<K, T> {
  // biome-ignore lint: This is a common pattern for branding types in TypeScript, and the assertion is necessary to satisfy the type system.
  return value as ProcessBrand<K, T>
}
