// Minimal server-friendly stub for solid-toast used in tests
function noop() {}

/** @public */
// biome-ignore lint/style/noDefaultExport: tests
export default Object.assign(noop, {
  success: noop,
  error: noop,
  info: noop,
  dismiss: noop,
})

/** @public */
export function Toaster() {
  return null
}

/** @public */
export const toasts = []

/** @public */
export function createToast() {
  return {
    show: () => {},
    hide: () => {},
  }
}
