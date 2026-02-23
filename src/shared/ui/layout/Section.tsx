import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

type SectionProps = {
  readonly children: JSX.Element
  readonly class?: string
  readonly title?: string
  readonly helperText?: string
}

export function Section(props: SectionProps): JSX.Element {
  return (
    <section class={props.class}>
      <Show when={props.title}>
        <h3 class="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {props.title}
        </h3>
      </Show>
      <Show when={props.helperText}>
        <p class="mb-4 text-xs text-slate-400">{props.helperText}</p>
      </Show>
      {props.children}
    </section>
  )
}
