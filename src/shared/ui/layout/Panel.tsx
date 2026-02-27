import type { JSX } from 'solid-js'

type PanelProps = {
  readonly children: JSX.Element
  readonly class?: string
  readonly bodyClass?: string
  readonly title?: string
  readonly subtitle?: string
  readonly headerSlot?: JSX.Element
}

export function Panel(props: PanelProps): JSX.Element {
  return (
    <section class={`rounded-lg border border-slate-200 bg-white ${props.class ?? ''}`.trim()}>
      {props.title || props.headerSlot ? (
        <header class="border-b border-slate-200 px-4 py-2.5">
          <div class="flex items-start justify-between gap-4">
            <div>
              {props.title ? (
                <h2 class="text-sm font-semibold text-slate-900">{props.title}</h2>
              ) : null}
              {props.subtitle ? (
                <p class="mt-0.5 text-xs text-slate-500">{props.subtitle}</p>
              ) : null}
            </div>
            {props.headerSlot ?? null}
          </div>
        </header>
      ) : null}
      <div class={props.bodyClass ?? ''}>{props.children}</div>
    </section>
  )
}
