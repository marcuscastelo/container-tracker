import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type {
  GlobalSearchResultItemVM,
  GlobalSearchUiState,
} from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import { GlobalSearchResultsView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchResultsView'

type GlobalSearchBodyViewProps = {
  readonly uiState: GlobalSearchUiState
  readonly showDiscoveryState: boolean
  readonly showEmptyState: boolean
  readonly errorLabel: string
  readonly discoveryLabel: string
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly emptyExamples: readonly string[]
  readonly loadingLabel: string
  readonly results: readonly GlobalSearchResultItemVM[]
  readonly activeIndex: number
  readonly onSelect: (item: GlobalSearchResultItemVM) => void
  readonly onHover: (index: number) => void
  readonly onVisiblePrefetch: (processIds: readonly string[]) => void
  readonly listLabel: string
}

function GlobalSearchMessageState(props: {
  readonly class: string
  readonly children: JSX.Element
}): JSX.Element {
  return <div class={props.class}>{props.children}</div>
}

function GlobalSearchEmptyState(props: {
  readonly title: string
  readonly description: string
  readonly examples: readonly string[]
}): JSX.Element {
  return (
    <div class="flex flex-col gap-3 px-4 py-6 text-center text-sm-ui text-text-muted">
      <div class="font-medium text-control-foreground">{props.title}</div>
      <div>{props.description}</div>
      <div class="flex flex-wrap justify-center gap-2">
        <For each={props.examples}>
          {(example) => (
            <span class="rounded border border-control-border bg-control-bg-hover px-2 py-1 text-xs-ui text-control-foreground">
              {example}
            </span>
          )}
        </For>
      </div>
    </div>
  )
}

export function GlobalSearchBodyView(props: GlobalSearchBodyViewProps): JSX.Element {
  return (
    <div class="max-h-[65vh] overflow-hidden">
      <Show when={props.uiState === 'error'}>
        <GlobalSearchMessageState class="px-4 py-6 text-center text-sm-ui text-tone-danger-fg">
          {props.errorLabel}
        </GlobalSearchMessageState>
      </Show>

      <Show when={props.showDiscoveryState}>
        <GlobalSearchMessageState class="px-4 py-6 text-center text-sm-ui text-text-muted">
          {props.discoveryLabel}
        </GlobalSearchMessageState>
      </Show>

      <Show when={props.showEmptyState}>
        <GlobalSearchEmptyState
          title={props.emptyTitle}
          description={props.emptyDescription}
          examples={props.emptyExamples}
        />
      </Show>

      <Show when={props.uiState === 'loading'}>
        <GlobalSearchMessageState class="px-4 py-6 text-center text-sm-ui text-text-muted">
          {props.loadingLabel}
        </GlobalSearchMessageState>
      </Show>

      <Show when={props.uiState === 'ready' && props.results.length > 0}>
        <GlobalSearchResultsView
          items={props.results}
          activeIndex={props.activeIndex}
          onSelect={props.onSelect}
          onHover={props.onHover}
          onVisiblePrefetch={props.onVisiblePrefetch}
          listLabel={props.listLabel}
        />
      </Show>
    </div>
  )
}
