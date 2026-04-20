import { Info } from 'lucide-solid'
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js'

type Props = {
  readonly buttonLabel: string
  readonly lines: readonly string[]
}

export function PredictionHistoryInfoTooltip(props: Props): JSX.Element {
  const [isOpen, setIsOpen] = createSignal(false)
  const tooltipId = createUniqueId()

  createEffect(() => {
    if (!isOpen()) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    onCleanup(() => {
      document.removeEventListener('keydown', handleEscape)
    })
  })

  return (
    <div class="relative inline-flex">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={props.buttonLabel}
        aria-describedby={isOpen() ? tooltipId : undefined}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
      >
        <Info class="h-4 w-4" aria-hidden="true" />
      </button>

      <Show when={isOpen()}>
        <div
          id={tooltipId}
          role="tooltip"
          class="absolute right-0 top-9 z-10 min-w-56 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg"
        >
          <div class="space-y-1 text-xs-ui text-foreground">
            <For each={props.lines}>{(line) => <p>{line}</p>}</For>
          </div>
        </div>
      </Show>
    </div>
  )
}
