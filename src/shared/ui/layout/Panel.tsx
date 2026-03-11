import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

type PanelProps = {
  readonly children: JSX.Element
  readonly class?: string
  readonly bodyClass?: string
  readonly title?: string
  readonly subtitle?: string
  readonly headerSlot?: JSX.Element
}

function PanelTitle(props: { readonly title?: string }): JSX.Element | null {
  return (
    <Show when={props.title}>
      <h2 class="text-micro font-semibold uppercase tracking-wider text-text-muted">
        {props.title}
      </h2>
    </Show>
  )
}

function PanelSubtitle(props: { readonly subtitle?: string }): JSX.Element | null {
  return (
    <Show when={props.subtitle}>
      <p class="mt-px text-micro text-text-muted">{props.subtitle}</p>
    </Show>
  )
}

export function Panel(props: PanelProps): JSX.Element {
  return (
    <section
      class={`rounded-lg border border-border bg-surface shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] ${props.class ?? ''}`.trim()}
    >
      <Show when={props.title || props.headerSlot}>
        <header class="border-b border-border/70 px-2.5 py-2">
          <div class="flex items-start justify-between gap-2">
            <div>
              <PanelTitle title={props.title} />
              <PanelSubtitle subtitle={props.subtitle} />
            </div>
            {props.headerSlot ?? null}
          </div>
        </header>
      </Show>
      <div class={props.bodyClass ?? ''}>{props.children}</div>
    </section>
  )
}
