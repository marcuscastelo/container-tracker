// Minimal server-friendly stub for solid-toast used in tests
/** @public */
// biome-ignore lint/style/noDefaultExport: tests
export default function toast() {
  return {
    success: () => {},
    error: () => {},
    info: () => {},
    dismiss: () => {},
  }
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
