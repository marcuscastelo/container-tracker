import type { JSX } from 'solid-js'

type SearchOverlayFooterProps = {
  readonly navigateLabel: string
  readonly selectLabel: string
  readonly closeLabel: string
}

export function SearchOverlayFooter(props: SearchOverlayFooterProps): JSX.Element {
  return (
    <div class="flex items-center justify-between border-t border-control-border bg-control-bg-hover px-4 py-2 text-xs-ui text-control-foreground">
      <div class="flex items-center gap-2">
        <kbd class="rounded border border-control-border bg-control-bg px-1 py-0.5 text-xs-ui text-control-popover-foreground">
          <svg
            class="inline-block h-3 w-3 align-text-center"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 22V1" />
            <path d="m5 8 7-7 7 7" />
            <path d="m5 16 7 7 7-7" />
          </svg>
        </kbd>
        <span>{props.navigateLabel}</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="rounded border border-control-border bg-control-bg px-1 py-0.5 text-xs-ui text-control-popover-foreground">
          <svg
            class="inline-block h-3 w-3 align-text-bottom"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </kbd>
        <span>{props.selectLabel}</span>
      </div>
      <div class="flex items-center gap-2">
        <kbd class="rounded border border-control-border bg-control-bg px-1 py-0.5 text-xs-ui text-control-popover-foreground">
          esc
        </kbd>
        <span>{props.closeLabel}</span>
      </div>
    </div>
  )
}
