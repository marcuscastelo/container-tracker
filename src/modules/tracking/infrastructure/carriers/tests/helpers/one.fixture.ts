import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import {
  OneCopEventsResponseSchema,
  type OneEndpointMeta,
  type OneRawSnapshot,
  OneSearchResponseSchema,
  OneVoyageListResponseSchema,
} from '~/modules/tracking/infrastructure/carriers/schemas/api/one.api.schema'
import copEventsJson from '~/modules/tracking/infrastructure/carriers/tests/fixtures/one/cop-events.json'
import searchJson from '~/modules/tracking/infrastructure/carriers/tests/fixtures/one/search.json'
import voyageListJson from '~/modules/tracking/infrastructure/carriers/tests/fixtures/one/voyage-list.json'

export const ONE_SEARCH_FIXTURE = OneSearchResponseSchema.parse(searchJson)
export const ONE_VOYAGE_LIST_FIXTURE = OneVoyageListResponseSchema.parse(voyageListJson)
export const ONE_COP_EVENTS_FIXTURE = OneCopEventsResponseSchema.parse(copEventsJson)

export const ONE_SAMPLE_CONTAINER_NUMBER = 'DRYU2434190'
export const ONE_SAMPLE_BOOKING_NO = 'KHIG05580700'
export const ONE_SNAPSHOT_ID = '00000000-0000-0000-0000-000000000191'
export const ONE_CONTAINER_ID = '00000000-0000-0000-0000-000000000192'

function okMeta(statusCode: number, receivedCount: number): OneEndpointMeta {
  return {
    ok: true,
    statusCode,
    error: null,
    receivedCount,
  }
}

export function makeOneRawPayload(command?: {
  readonly search?: unknown | null
  readonly voyageList?: unknown | null
  readonly copEvents?: unknown | null
  readonly containerNumber?: string
  readonly bookingNo?: string | null
  readonly searchMeta?: OneEndpointMeta
  readonly voyageListMeta?: OneEndpointMeta
  readonly copEventsMeta?: OneEndpointMeta
}): OneRawSnapshot {
  return {
    provider: 'one',
    search: command?.search === undefined ? ONE_SEARCH_FIXTURE : command.search,
    voyageList: command?.voyageList === undefined ? ONE_VOYAGE_LIST_FIXTURE : command.voyageList,
    copEvents: command?.copEvents === undefined ? ONE_COP_EVENTS_FIXTURE : command.copEvents,
    requestMeta: {
      containerNumber:
        command?.containerNumber === undefined
          ? ONE_SAMPLE_CONTAINER_NUMBER
          : command.containerNumber,
      bookingNo: command?.bookingNo === undefined ? ONE_SAMPLE_BOOKING_NO : command.bookingNo,
    },
    endpointMeta: {
      search: command?.searchMeta ?? okMeta(200, ONE_SEARCH_FIXTURE.data.length),
      voyageList: command?.voyageListMeta ?? okMeta(200, ONE_VOYAGE_LIST_FIXTURE.data.length),
      copEvents: command?.copEventsMeta ?? okMeta(200, ONE_COP_EVENTS_FIXTURE.data.length),
    },
  }
}

export function makeOneSnapshot(payload: unknown): Snapshot {
  return {
    id: ONE_SNAPSHOT_ID,
    container_id: ONE_CONTAINER_ID,
    provider: 'one',
    fetched_at: '2026-04-02T12:00:00.000Z',
    payload,
  }
}
