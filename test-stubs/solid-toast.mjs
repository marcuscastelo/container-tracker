// Minimal server-friendly stub for solid-toast used in tests
// biome-ignore lint/style/noDefaultExport: tests
export default function toast() {
  return {
    success: () => {},
    error: () => {},
    info: () => {},
    dismiss: () => {},
  }
}

export const toasts = []
export function createToast() {
  return {
    show: () => {},
    hide: () => {},
  }
}
