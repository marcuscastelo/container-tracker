export type Brand<K, T> = K & { readonly __brand: T }

export function toBrand<K, T>(value: K): Brand<K, T> {
  // biome-ignore lint: This is a common pattern for branding types in TypeScript, and the assertion is necessary to satisfy the type system.
  return value as Brand<K, T>
}
