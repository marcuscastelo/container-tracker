import type { JSX } from 'solid-js'
import { Match, Switch } from 'solid-js'
import { BRFlag } from '~/shared/ui/icons/flags/BRFlag'
import { PTFlag } from '~/shared/ui/icons/flags/PTFlag'
import { USFlag } from '~/shared/ui/icons/flags/USFlag'

type FlagProps = { readonly locale: string; readonly class?: string }

export function FlagIcon(props: FlagProps): JSX.Element {
  const code = () => props.locale.slice(0, 2).toUpperCase()

  // Render a single JSX tree and branch inside to preserve Solid reactivity
  return (
    <Switch>
      <Match when={props.locale === 'en-US'}>
        <USFlag class={props.class} />
      </Match>
      <Match when={props.locale === 'pt-BR'}>
        <BRFlag class={props.class} />
      </Match>
      <Match when={props.locale === 'pt-PT'}>
        <PTFlag class={props.class} />
      </Match>
      <Match when={true}>
        <svg class={props.class} viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg">
          <title>{`Flag for locale ${props.locale}`}</title>
          <rect width="24" height="16" x="0" y="4" rx="2" fill="#CBD5E1" />
          <text
            x="12"
            y="14"
            text-anchor="middle"
            alignment-baseline="middle"
            font-family="Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto"
            font-size="8"
            font-weight="700"
            fill="#0F172A"
          >
            {code()}
          </text>
        </svg>
      </Match>
    </Switch>
  )
}
