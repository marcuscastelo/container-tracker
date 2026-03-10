import type { JSX } from 'solid-js'

type FlagProps = { readonly class?: string; readonly width?: number; readonly height?: number }

/**
 * Portugal flag component.
 * Source: Wikimedia Commons (public domain / public domain-like) - https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg
 */
export function PTFlag(props: FlagProps): JSX.Element {
  const src = 'https://upload.wikimedia.org/wikipedia/commons/5/5c/Flag_of_Portugal.svg'
  return (
    <img
      class={props.class}
      src={src}
      alt="Portugal flag"
      width={props.width}
      height={props.height}
    />
  )
}
