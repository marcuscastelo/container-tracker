import type { JSX } from 'solid-js'
import { createEffect, For, onCleanup } from 'solid-js'
import type { GlobalSearchResultItemVM } from '~/capabilities/search/ui/screens/global-search/types/global-search.vm'
import { GlobalSearchResultRow } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchResultRow'
import { GLOBAL_SEARCH_RESULTS_LIST_ID } from '~/capabilities/search/ui/screens/global-search/views/globalSearch.a11y'
import { createViewportPrefetchController } from '~/shared/ui/navigation/app-navigation'

type VisibleSearchResultRect = {
  readonly bottom: number
  readonly top: number
}

type VisibleSearchResultRow = {
  readonly dataset: {
    readonly searchProcessId?: string
  }
  readonly getBoundingClientRect: () => VisibleSearchResultRect
}

type VisibleSearchResultContainer = {
  readonly getBoundingClientRect: () => VisibleSearchResultRect
  readonly querySelectorAll: (selector: string) => Iterable<VisibleSearchResultRow>
}

type GlobalSearchResultsViewProps = {
  readonly items: readonly GlobalSearchResultItemVM[]
  readonly activeIndex: number
  readonly onSelect: (item: GlobalSearchResultItemVM) => void
  readonly onHover: (index: number) => void
  readonly onVisiblePrefetch: (processIds: readonly string[]) => void
  readonly listLabel: string
}

export function collectVisibleSearchResultProcessIds(
  container: VisibleSearchResultContainer | undefined,
): readonly string[] {
  if (!container) return []

  const containerRect = container.getBoundingClientRect()
  const rows = container.querySelectorAll('[data-search-process-id]')
  const visibleProcessIds: string[] = []

  for (const row of rows) {
    const processId = row.dataset.searchProcessId
    if (!processId) continue

    const rowRect = row.getBoundingClientRect()
    if (rowRect.bottom <= containerRect.top || rowRect.top >= containerRect.bottom) continue

    visibleProcessIds.push(processId)
  }

  return visibleProcessIds
}

export function GlobalSearchResultsView(props: GlobalSearchResultsViewProps): JSX.Element {
  let containerRef: HTMLDivElement | undefined

  const viewportPrefetchController = createViewportPrefetchController({
    collectVisibleKeys: () => collectVisibleSearchResultProcessIds(containerRef),
    onVisibleKeysSettled: (processIds: readonly string[]) => props.onVisiblePrefetch(processIds),
  })

  createEffect(() => {
    if (props.items.length === 0) return
    viewportPrefetchController.schedule()
  })

  createEffect(() => {
    const container = containerRef
    if (!container) return

    const schedulePrefetch = () => {
      viewportPrefetchController.schedule()
    }

    container.addEventListener('scroll', schedulePrefetch, { passive: true })
    window.addEventListener('resize', schedulePrefetch)

    onCleanup(() => {
      container.removeEventListener('scroll', schedulePrefetch)
      window.removeEventListener('resize', schedulePrefetch)
      viewportPrefetchController.dispose()
    })
  })

  return (
    <div
      id={GLOBAL_SEARCH_RESULTS_LIST_ID}
      ref={(element) => {
        containerRef = element
      }}
      class="max-h-[32rem] overflow-y-auto"
      role="listbox"
      aria-label={props.listLabel}
    >
      <For each={props.items}>
        {(item, index) => (
          <GlobalSearchResultRow
            item={item}
            index={index()}
            active={props.activeIndex === index()}
            onSelect={props.onSelect}
            onHover={props.onHover}
          />
        )}
      </For>
    </div>
  )
}
