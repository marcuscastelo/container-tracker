import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js'

/**
 * Returns a debounced signal and setter based on a source accessor.
 * @template T
 * @param source Source signal accessor.
 * @param delay Debounce delay in milliseconds.
 * @returns Tuple: [debounced accessor, debounced setter].
 */
export function createDebouncedSignal<T>(
  source: Accessor<T>,
  delay: number,
): [Accessor<T>, (v: T) => void] {
  const [value, setValue] = createSignal<T>(source())
  let timeout: ReturnType<typeof setTimeout> | null = null

  const setValueWithDebounce = (v: T) => {
    if (typeof v === 'function') {
      throw new Error('Function values are not supported for debounced signals')
    }
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      setValue(() => v)
    }, delay)
  }

  createEffect(() => {
    // Every time the source changes, we trigger the debounced setter
    setValueWithDebounce(source())

    // Cleanup any pending timeout when the effect is disposed
    onCleanup(() => {
      if (timeout) clearTimeout(timeout)
    })
  })

  return [value, setValueWithDebounce]
}
