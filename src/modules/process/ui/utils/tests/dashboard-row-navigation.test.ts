import { describe, expect, it, vi } from 'vitest'
import {
  hasDashboardRowSelectedText,
  shouldHandleDashboardRowClick,
  shouldHandleDashboardRowKeydown,
} from '~/modules/process/ui/utils/dashboard-row-navigation'

describe('dashboard-row-navigation', () => {
  it('accepts plain left click on non-interactive target', () => {
    expect(
      shouldHandleDashboardRowClick({
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        interactiveTarget: false,
        hasSelectedText: false,
      }),
    ).toBe(true)
  })

  it('ignores modified or non-primary clicks', () => {
    expect(
      shouldHandleDashboardRowClick({
        defaultPrevented: false,
        button: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        interactiveTarget: false,
        hasSelectedText: false,
      }),
    ).toBe(false)

    expect(
      shouldHandleDashboardRowClick({
        defaultPrevented: false,
        button: 0,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        interactiveTarget: false,
        hasSelectedText: false,
      }),
    ).toBe(false)
  })

  it('ignores interactive targets and text selection', () => {
    expect(
      shouldHandleDashboardRowClick({
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        interactiveTarget: true,
        hasSelectedText: false,
      }),
    ).toBe(false)

    expect(
      shouldHandleDashboardRowClick({
        defaultPrevented: false,
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        interactiveTarget: false,
        hasSelectedText: true,
      }),
    ).toBe(false)
  })

  it('handles keyboard activation only for Enter and Space', () => {
    expect(
      shouldHandleDashboardRowKeydown({
        defaultPrevented: false,
        key: 'Enter',
        interactiveTarget: false,
      }),
    ).toBe(true)

    expect(
      shouldHandleDashboardRowKeydown({
        defaultPrevented: false,
        key: ' ',
        interactiveTarget: false,
      }),
    ).toBe(true)

    expect(
      shouldHandleDashboardRowKeydown({
        defaultPrevented: false,
        key: 'Escape',
        interactiveTarget: false,
      }),
    ).toBe(false)
  })

  it('detects selected text when selection API is available', () => {
    const originalGetSelection = globalThis.getSelection
    const getSelectionMock = vi.fn(() => ({
      toString: () => ' selected ',
    }))

    Object.defineProperty(globalThis, 'getSelection', {
      value: getSelectionMock,
      configurable: true,
    })

    expect(hasDashboardRowSelectedText()).toBe(true)

    Object.defineProperty(globalThis, 'getSelection', {
      value: originalGetSelection,
      configurable: true,
    })
  })
})
