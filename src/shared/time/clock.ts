import { Instant } from '~/shared/time/instant'

export type Clock = {
  now(): Instant
}

export const systemClock: Clock = {
  now() {
    return Instant.fromEpochMs(Date.now())
  },
}
