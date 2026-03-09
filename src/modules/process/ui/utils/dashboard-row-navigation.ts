const INTERACTIVE_ROW_TARGET_SELECTOR = 'a,button,input,select,textarea,[data-no-row-nav]'

type DashboardRowClickCommand = {
  readonly defaultPrevented: boolean
  readonly button: number
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly interactiveTarget: boolean
  readonly hasSelectedText: boolean
}

type DashboardRowKeydownCommand = {
  readonly defaultPrevented: boolean
  readonly key: string
  readonly interactiveTarget: boolean
}

export function isInteractiveDashboardRowTarget(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null
  if (element === null) return false
  return element.closest(INTERACTIVE_ROW_TARGET_SELECTOR) !== null
}

export function hasDashboardRowSelectedText(): boolean {
  const selectedText = globalThis.getSelection?.()?.toString().trim() ?? ''
  return selectedText.length > 0
}

export function shouldHandleDashboardRowClick(command: DashboardRowClickCommand): boolean {
  if (command.defaultPrevented) return false
  if (command.button !== 0) return false
  if (command.metaKey || command.ctrlKey || command.shiftKey || command.altKey) return false
  if (command.interactiveTarget) return false
  if (command.hasSelectedText) return false
  return true
}

export function shouldHandleDashboardRowKeydown(command: DashboardRowKeydownCommand): boolean {
  if (command.defaultPrevented) return false
  if (command.interactiveTarget) return false
  return command.key === 'Enter' || command.key === ' '
}
