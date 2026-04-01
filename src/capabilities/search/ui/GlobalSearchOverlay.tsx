import type { JSX } from 'solid-js'
import { SearchOverlay } from '~/capabilities/search/ui/SearchOverlay'

// biome-ignore lint/style/noDefaultExport: Used as a lazily loaded component, so default export is more convenient
export default function GlobalSearchOverlay(): JSX.Element {
  return <SearchOverlay />
}
