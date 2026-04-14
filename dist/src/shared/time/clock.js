import { Instant } from '~/shared/time/instant';
export const systemClock = {
    now() {
        return Instant.fromEpochMs(Date.now());
    },
};
