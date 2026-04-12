import type { JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import type { MotionDurationToken } from '~/shared/ui/motion/motion.tokens'
import {
  clearMotionTimeout,
  scheduleMotionFrame,
  scheduleMotionTimeout,
  toMotionDurationCssValue,
  toMotionDurationMs,
} from '~/shared/ui/motion/motion.utils'

type MotionCollapseProps = {
  readonly open: boolean
  readonly children: JSX.Element
  readonly class?: string
  readonly innerClass?: string
  readonly duration?: MotionDurationToken
}

type MotionCollapseEasing = 'enter' | 'exit'

export function buildMotionCollapseTransition(
  duration: MotionDurationToken,
  easing: MotionCollapseEasing,
): string {
  const durationCssValue = toMotionDurationCssValue(duration)
  return `height ${durationCssValue} var(--motion-ease-${easing}), opacity ${durationCssValue} var(--motion-ease-${easing})`
}

export function MotionCollapse(props: MotionCollapseProps): JSX.Element {
  const [isMounted, setIsMounted] = createSignal(false)
  const [inlineStyle, setInlineStyle] = createSignal<Record<string, string>>({})
  let containerRef: HTMLDivElement | undefined
  let timeoutId: number | null = null

  createEffect(() => {
    const shouldOpen = props.open
    const durationValue = props.duration ?? 'panel'
    const durationMs = toMotionDurationMs(durationValue)

    clearMotionTimeout(timeoutId)

    if (durationMs === 0) {
      setIsMounted(shouldOpen)
      setInlineStyle(
        shouldOpen
          ? {}
          : {
              height: '0px',
              opacity: '0',
              overflow: 'hidden',
            },
      )
      return
    }

    if (shouldOpen) {
      setIsMounted(true)
      scheduleMotionFrame(() => {
        const nextHeight = containerRef?.scrollHeight ?? 0
        setInlineStyle({
          height: `${nextHeight}px`,
          opacity: '1',
          overflow: 'hidden',
          transition: buildMotionCollapseTransition(durationValue, 'enter'),
        })

        timeoutId = scheduleMotionTimeout(() => {
          setInlineStyle({})
          timeoutId = null
        }, durationValue)
      })
      return
    }

    if (!isMounted()) {
      setInlineStyle({
        height: '0px',
        opacity: '0',
        overflow: 'hidden',
      })
      return
    }

    const nextHeight = containerRef?.scrollHeight ?? 0
    setInlineStyle({
      height: `${nextHeight}px`,
      opacity: '1',
      overflow: 'hidden',
    })

    scheduleMotionFrame(() => {
      setInlineStyle({
        height: '0px',
        opacity: '0',
        overflow: 'hidden',
        transition: buildMotionCollapseTransition(durationValue, 'exit'),
      })
    })

    timeoutId = scheduleMotionTimeout(() => {
      setIsMounted(false)
      timeoutId = null
    }, durationValue)
  })

  onCleanup(() => {
    clearMotionTimeout(timeoutId)
  })

  return (
    <div class={props.class}>
      <Show when={props.open || isMounted()}>
        <div
          ref={containerRef}
          style={props.open && !isMounted() ? {} : inlineStyle()}
          class={props.innerClass}
        >
          {props.children}
        </div>
      </Show>
    </div>
  )
}
