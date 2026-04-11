import type { JSX } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { SearchOverlayFooter } from '~/capabilities/search/ui/SearchOverlay.footer'
import { SearchTriggerButton } from '~/capabilities/search/ui/SearchOverlay.trigger'
import { useGlobalSearchController } from '~/capabilities/search/ui/screens/global-search/hooks/useGlobalSearchController'
import { GlobalSearchBodyView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchBodyView'
import { GlobalSearchComposerView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchComposerView'
import { GlobalSearchSuggestionsView } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchSuggestionsView'
import {
  resolveGlobalSearchActiveDescendantId,
  resolveGlobalSearchActiveListId,
} from '~/capabilities/search/ui/screens/global-search/views/globalSearch.a11y'
import { useTranslation } from '~/shared/localization/i18n'

function readNavigatorPlatform(): string | undefined {
  const userAgentData = Reflect.get(navigator, 'userAgentData')
  if (typeof userAgentData !== 'object' || userAgentData === null) return undefined

  const platform = Reflect.get(userAgentData, 'platform')
  return typeof platform === 'string' ? platform : undefined
}

function detectShortcutLabel(): string {
  const rawPlatform = readNavigatorPlatform() ?? navigator.platform
  const platform = typeof rawPlatform === 'string' ? rawPlatform.toLowerCase() : ''
  const userAgent = typeof navigator.userAgent === 'string' ? navigator.userAgent.toLowerCase() : ''
  const isApplePlatform =
    platform.includes('mac') ||
    platform.includes('iphone') ||
    platform.includes('ipad') ||
    platform.includes('ipod') ||
    userAgent.includes('mac os') ||
    userAgent.includes('iphone') ||
    userAgent.includes('ipad')

  return isApplePlatform ? '⌘K' : 'Ctrl K'
}

export function GlobalSearchDialog(): JSX.Element {
  const translation = useTranslation()
  const controller = useGlobalSearchController()
  const [shortcutLabel, setShortcutLabel] = createSignal('Ctrl K')

  const activeA11yState = () => ({
    showSuggestions: controller.showSuggestions(),
    showResults: controller.uiState() === 'ready' && controller.results().length > 0,
    activeSuggestionIndex: controller.activeSuggestionIndex(),
    activeResultIndex: controller.activeResultIndex(),
  })

  const activeListId = () => resolveGlobalSearchActiveListId(activeA11yState())
  const activeDescendantId = () => resolveGlobalSearchActiveDescendantId(activeA11yState())

  onMount(() => {
    setShortcutLabel(detectShortcutLabel())
  })

  return (
    <>
      <SearchTriggerButton
        placeholder={translation.t(translation.keys.search.placeholder)}
        shortcutLabel={shortcutLabel()}
        onOpen={() => controller.open()}
      />

      <Show when={controller.isOpen()}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center px-2 pt-[8vh] sm:px-4"
          style={{ animation: 'search-overlay-in 150ms ease-out' }}
        >
          <button
            type="button"
            class="absolute inset-0 bg-ring/60 backdrop-blur-sm"
            onClick={() => controller.close()}
            aria-label={translation.t(translation.keys.search.close)}
          />

          <div
            class="relative z-10 w-full max-w-5xl overflow-hidden rounded-xl border border-control-border bg-control-popover shadow-2xl"
            style={{ animation: 'search-modal-in 150ms ease-out' }}
            role="dialog"
            aria-modal="true"
            aria-label={translation.t(translation.keys.search.placeholder)}
          >
            <GlobalSearchComposerView
              chips={controller.chips()}
              draft={controller.draft()}
              placeholder={translation.t(translation.keys.search.placeholder)}
              clearLabel={translation.t(translation.keys.search.clear)}
              onDraftInput={controller.setDraft}
              onKeyDown={controller.handleComposerKeyDown}
              onRemoveChip={controller.removeChip}
              onClear={controller.clearComposer}
              setInputRef={controller.setInputRef}
              expanded={activeListId() !== undefined}
              listboxId={activeListId()}
              activeDescendantId={activeDescendantId()}
            />

            <Show when={controller.showSuggestions()}>
              <GlobalSearchSuggestionsView
                suggestions={controller.suggestions()}
                activeIndex={controller.activeSuggestionIndex()}
                onSelect={controller.acceptSuggestion}
                onHover={controller.setActiveSuggestionIndex}
                listLabel={translation.t(translation.keys.search.a11y.suggestionsList)}
              />
            </Show>

            <GlobalSearchBodyView
              uiState={controller.uiState()}
              showDiscoveryState={
                controller.uiState() === 'empty' &&
                controller.draft().trim().length === 0 &&
                controller.chips().length === 0
              }
              showEmptyState={
                controller.uiState() === 'empty' &&
                (controller.draft().trim().length > 0 || controller.chips().length > 0)
              }
              errorLabel={translation.t(translation.keys.search.error)}
              discoveryLabel={translation.t(translation.keys.search.empty.discovery)}
              emptyTitle={controller.emptyTitle()}
              emptyDescription={controller.emptyDescription()}
              emptyExamples={controller.emptyExamples()}
              loadingLabel={translation.t(translation.keys.search.loading)}
              results={controller.results()}
              activeIndex={controller.activeResultIndex()}
              onSelect={controller.navigateToResult}
              onHover={(index) => {
                controller.setActiveResultIndex(index)
                const item = controller.results()[index]
                if (item !== undefined) {
                  controller.prefetchResultIntent(item.processId)
                }
              }}
              onVisiblePrefetch={controller.prefetchVisibleResults}
              listLabel={translation.t(translation.keys.search.a11y.resultsList)}
            />

            <SearchOverlayFooter
              navigateLabel={translation.t(translation.keys.search.footer.navigate)}
              selectLabel={translation.t(translation.keys.search.footer.select)}
              closeLabel={translation.t(translation.keys.search.footer.close)}
            />
          </div>
        </div>
      </Show>
    </>
  )
}
