export type ContainerBrand<K, T> = K & {
  readonly __brand: T
  readonly __brandContext: 'ContainerModule'
}

export function toContainerBrand<K, T>(value: K): ContainerBrand<K, T> {
  // biome-ignore lint: This is a common pattern for branding types in TypeScript, and the assertion is necessary to satisfy the type system.
  return value as ContainerBrand<K, T>
}
