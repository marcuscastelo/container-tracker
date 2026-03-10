import type { JSX } from 'solid-js'

type FlagProps = { readonly class?: string; readonly width?: number; readonly height?: number }

/**
 * United States flag component.
 * Source: Wikimedia Commons (public domain) - https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg
 */
export function USFlag(props: FlagProps): JSX.Element {
  const src = 'https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg'
  return (
    <img
      class={props.class}
      src={src}
      alt="United States flag"
      width={props.width}
      height={props.height}
    />
  )
}
