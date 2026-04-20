import { type Accessor, createComputed, createSignal, onCleanup } from 'solid-js'
import {
  clearMotionTimeout,
  scheduleMotionTimeout,
  toMotionDurationMs,
} from '~/shared/ui/motion/motion.utils'

type SwapPhase = 'idle' | 'out' | 'in'

type UseSwapTransitionCommand<T> = {
  readonly key: Accessor<T>
}

type UseSwapTransitionResult<T> = {
  readonly renderedKey: Accessor<T>
  readonly phase: Accessor<SwapPhase>
}

export function useSwapTransition<T>(
  command: UseSwapTransitionCommand<T>,
): UseSwapTransitionResult<T> {
  const [renderedKey, setRenderedKey] = createSignal(command.key())
  const [phase, setPhase] = createSignal<SwapPhase>('idle')
  let outTimeoutId: number | null = null
  let inTimeoutId: number | null = null

  createComputed(() => {
    const nextKey = command.key()
    const currentRenderedKey = renderedKey()
    if (Object.is(nextKey, currentRenderedKey)) {
      return
    }

    clearMotionTimeout(outTimeoutId)
    clearMotionTimeout(inTimeoutId)

    if (toMotionDurationMs('fast') === 0 && toMotionDurationMs('base') === 0) {
      setRenderedKey(() => nextKey)
      setPhase('idle')
      return
    }

    setPhase('out')
    outTimeoutId = scheduleMotionTimeout(() => {
      setRenderedKey(() => nextKey)
      setPhase('in')
      inTimeoutId = scheduleMotionTimeout(() => {
        setPhase('idle')
        inTimeoutId = null
      }, 'base')
      outTimeoutId = null
    }, 'fast')
  })

  onCleanup(() => {
    clearMotionTimeout(outTimeoutId)
    clearMotionTimeout(inTimeoutId)
  })

  return {
    renderedKey,
    phase,
  }
}
