import type { JSX } from 'solid-js'
import { collectVisibleSearchResultProcessIds } from '~/capabilities/search/ui/screens/global-search/views/GlobalSearchResultsView'

export { collectVisibleSearchResultProcessIds }

export function SearchOverlayPanel(): JSX.Element {
  return <div hidden aria-hidden="true" />
}
