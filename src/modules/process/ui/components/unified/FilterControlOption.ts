import type { JSX } from 'solid-js'

export type FilterControlOption<T extends string> = {
  readonly value: T
  readonly label: string
  readonly count: number
}

export type { JSX }
