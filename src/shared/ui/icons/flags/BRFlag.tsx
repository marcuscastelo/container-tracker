import type { JSX } from 'solid-js'

type FlagProps = { readonly class?: string; readonly width?: number; readonly height?: number }

/**
 * Brazil flag component.
 * Source: Wikimedia Commons (public domain / government) - https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg
 */
export function BRFlag(props: FlagProps): JSX.Element {
  const src = 'https://upload.wikimedia.org/wikipedia/commons/0/05/Flag_of_Brazil.svg'
  return (
    <img
      class={props.class}
      src={src}
      alt="Brazil flag"
      width={props.width}
      height={props.height}
    />
  )
}
