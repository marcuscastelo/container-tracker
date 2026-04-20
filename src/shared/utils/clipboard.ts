// Small clipboard utility with fallback for older browsers
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // ignore and try fallback
  }

  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'absolute'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    const selection = document.getSelection()
    const range = document.createRange()
    range.selectNodeContents(ta)
    if (selection) {
      selection.removeAllRanges()
      selection.addRange(range)
    }
    ta.select()
    const copied = document.execCommand('copy')
    if (selection) selection.removeAllRanges()
    document.body.removeChild(ta)
    return copied
  } catch {
    // give up silently
  }

  return false
}
