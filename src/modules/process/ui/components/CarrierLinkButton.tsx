import { type JSX, Show } from 'solid-js'
import { copyToClipboard } from '~/shared/utils/clipboard'

type CarrierLinkButtonProps = {
  readonly href?: string | undefined
  readonly containerNumber?: string | null | undefined
  readonly label: string
  readonly class?: string | undefined
}

async function copyAndOpenCarrierLink(
  href: string,
  containerNumber?: string | null,
): Promise<void> {
  try {
    if (containerNumber) {
      await copyToClipboard(containerNumber)
    }
  } catch {
    /* ignore copy failures */
  }

  try {
    window.open(href, '_blank')
  } catch {
    /* ignore window open failures */
  }
}

export function CarrierLinkButton(props: CarrierLinkButtonProps): JSX.Element | null {
  const className = () => {
    const baseClass =
      'inline-flex h-4 w-4 items-center justify-center rounded text-text-muted hover:text-foreground'

    if (!props.class) return baseClass
    return `${baseClass} ${props.class}`
  }

  return (
    <Show when={props.href}>
      {(href) => (
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          title={props.label}
          aria-label={props.label}
          class={className()}
          onClick={(event) => {
            event.preventDefault()
            void copyAndOpenCarrierLink(href(), props.containerNumber)
          }}
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <title>{props.label}</title>
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
            />
          </svg>
        </a>
      )}
    </Show>
  )
}
