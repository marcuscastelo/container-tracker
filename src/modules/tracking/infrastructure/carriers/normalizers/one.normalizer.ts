import { normalizeVesselName } from '~/modules/tracking/domain/identity/normalizeVesselName'
import type { Snapshot } from '~/modules/tracking/domain/model/snapshot'
import type {
  Confidence,
  ObservationDraft,
} from '~/modules/tracking/features/observation/domain/model/observationDraft'
import type { ObservationType } from '~/modules/tracking/features/observation/domain/model/observationType'
import { toLookupMapKey } from '~/modules/tracking/infrastructure/carriers/normalizers/lookup-key'
import {
  mapOneTriggerType,
  resolveOneSemanticEvent,
} from '~/modules/tracking/infrastructure/carriers/normalizers/one.mapping'
import { resolveOneEventTemporal } from '~/modules/tracking/infrastructure/carriers/normalizers/one.temporal'
import {
  type OneCopEdhVessel,
  type OneCopEvent,
  OneCopEventsResponseSchema,
  type OneCopVessel,
  type OneRawSnapshot,
  OneRawSnapshotSchema,
  type OneSearchCargoEvent,
  type OneSearchContainer,
  OneSearchResponseSchema,
  type OneVoyageLeg,
  OneVoyageListResponseSchema,
} from '~/modules/tracking/infrastructure/carriers/schemas/api/one.api.schema'

type OneVoyageLegContext = {
  readonly vesselCode: string | null
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly polCode: string | null
  readonly polDisplay: string | null
  readonly podCode: string | null
  readonly podDisplay: string | null
  readonly raw: OneVoyageLeg
}

function toTrimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeContainerNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

function normalizeCode(value: string | null | undefined): string | null {
  const trimmed = toTrimmedOrNull(value)
  return trimmed === null ? null : trimmed.toUpperCase()
}

function toCarrierLabelOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  return value.trim().length > 0 ? value : null
}

function toLocationDisplay(command: {
  readonly locationName: string | null | undefined
  readonly countryName: string | null | undefined
}): string | null {
  const locationName = toTrimmedOrNull(command.locationName)
  const countryName = toTrimmedOrNull(command.countryName)

  if (locationName === null && countryName === null) return null
  if (locationName === null) return countryName
  if (countryName === null) return locationName
  return `${locationName}, ${countryName}`
}

function buildVoyageId(command: {
  readonly voyageNo: string | null | undefined
  readonly directionCode: string | null | undefined
  readonly consortiumVoyage: string | null | undefined
}): string | null {
  const consortiumVoyage = toTrimmedOrNull(command.consortiumVoyage)
  if (consortiumVoyage !== null) return consortiumVoyage.toUpperCase()

  const voyageNo = toTrimmedOrNull(command.voyageNo)
  const directionCode = toTrimmedOrNull(command.directionCode)
  if (voyageNo === null && directionCode === null) return null
  return `${voyageNo ?? ''}${directionCode ?? ''}`.toUpperCase()
}

function isMaritimeEvent(type: ObservationType): boolean {
  return type === 'LOAD' || type === 'DEPARTURE' || type === 'ARRIVAL' || type === 'DISCHARGE'
}

function buildOneLegContexts(rawSnapshot: OneRawSnapshot): readonly OneVoyageLegContext[] {
  const voyageListResult = OneVoyageListResponseSchema.safeParse(rawSnapshot.voyageList)
  if (!voyageListResult.success) return []
  if (voyageListResult.data.status !== 200 || voyageListResult.data.code !== 1) return []

  return voyageListResult.data.data.map((leg) => ({
    vesselCode: normalizeCode(leg.vesselCode),
    vesselName: toTrimmedOrNull(leg.vesselEngName),
    voyage: buildVoyageId({
      voyageNo: leg.scheduleVoyageNumber,
      directionCode: leg.scheduleDirectionCode,
      consortiumVoyage: leg.inboundConsortiumVoyage ?? leg.outboundConsortiumVoyage ?? null,
    }),
    polCode: normalizeCode(leg.pol?.locationCode ?? null),
    polDisplay: toTrimmedOrNull(leg.pol?.locationName ?? null),
    podCode: normalizeCode(leg.pod?.locationCode ?? null),
    podDisplay: toTrimmedOrNull(leg.pod?.locationName ?? null),
    raw: leg,
  }))
}

function buildLocationDirectory(
  searchContainer: OneSearchContainer | null,
  legs: readonly OneVoyageLegContext[],
): ReadonlyMap<string, string> {
  const directory = new Map<string, string>()

  function addAlias(code: string | null, ...aliases: readonly (string | null | undefined)[]): void {
    if (code === null) return
    for (const alias of aliases) {
      const trimmed = toTrimmedOrNull(alias)
      if (trimmed === null) continue
      directory.set(toLookupMapKey(trimmed), code)
    }
  }

  addAlias(
    normalizeCode(searchContainer?.por?.code),
    searchContainer?.por?.locationName ?? null,
    toLocationDisplay({
      locationName: searchContainer?.por?.locationName ?? null,
      countryName: searchContainer?.por?.countryName ?? null,
    }),
  )
  addAlias(
    normalizeCode(searchContainer?.pod?.code),
    searchContainer?.pod?.locationName ?? null,
    toLocationDisplay({
      locationName: searchContainer?.pod?.locationName ?? null,
      countryName: searchContainer?.pod?.countryName ?? null,
    }),
  )

  for (const leg of legs) {
    addAlias(leg.polCode, leg.polDisplay)
    addAlias(leg.podCode, leg.podDisplay)
  }

  return directory
}

function resolveCargoEventLocationCode(
  cargoEvent: OneSearchCargoEvent,
  locationDirectory: ReadonlyMap<string, string>,
): string | null {
  const locationName = toTrimmedOrNull(cargoEvent.locationName)
  if (locationName === null) return null

  const locationDisplay = toLocationDisplay({
    locationName,
    countryName: cargoEvent.countryName ?? cargoEvent.countryCode ?? null,
  })

  if (locationDisplay !== null) {
    const displayMatch = locationDirectory.get(toLookupMapKey(locationDisplay))
    if (displayMatch !== undefined) return displayMatch
  }

  const nameMatch = locationDirectory.get(toLookupMapKey(locationName))
  return nameMatch ?? null
}

function normalizeVesselCodeOrNull(value: string | null | undefined): string | null {
  const trimmed = toTrimmedOrNull(value)
  return trimmed === null ? null : trimmed.toUpperCase()
}

function isOneEdhVessel(vessel: OneCopVessel | OneCopEdhVessel): vessel is OneCopEdhVessel {
  return 'inboundConsortiumVoyage' in vessel || 'outboundConsortiumVoyage' in vessel
}

function buildCandidateVoyage(
  vessel: OneCopVessel | OneCopEdhVessel | null | undefined,
): string | null {
  if (vessel === null || vessel === undefined) return null
  return buildVoyageId({
    voyageNo: vessel.voyNo,
    directionCode: vessel.dirCode,
    consortiumVoyage: isOneEdhVessel(vessel)
      ? (vessel.inboundConsortiumVoyage ?? vessel.outboundConsortiumVoyage ?? null)
      : null,
  })
}

function matchesLegIdentity(command: {
  readonly leg: OneVoyageLegContext
  readonly vessel: OneCopVessel | OneCopEdhVessel
}): boolean {
  const candidateCode = normalizeVesselCodeOrNull(command.vessel.code)
  const candidateName = toTrimmedOrNull(command.vessel.name)
  const candidateVoyage = buildCandidateVoyage(command.vessel)

  const codeMatches =
    candidateCode !== null &&
    command.leg.vesselCode !== null &&
    candidateCode === command.leg.vesselCode
  const nameMatches =
    candidateName !== null &&
    command.leg.vesselName !== null &&
    normalizeVesselName(candidateName) === normalizeVesselName(command.leg.vesselName)
  const voyageMatches =
    candidateVoyage !== null &&
    command.leg.voyage !== null &&
    candidateVoyage === command.leg.voyage

  if (codeMatches && (voyageMatches || candidateVoyage === null || command.leg.voyage === null)) {
    return true
  }

  if (nameMatches && (voyageMatches || candidateVoyage === null || command.leg.voyage === null)) {
    return true
  }

  return voyageMatches
}

function findLegByLocationRole(command: {
  readonly legs: readonly OneVoyageLegContext[]
  readonly locationCode: string | null
  readonly type: ObservationType
}): OneVoyageLegContext | null {
  if (command.locationCode === null) return null

  const matches = command.legs.filter((leg) => {
    if (command.type === 'LOAD' || command.type === 'DEPARTURE') {
      return leg.polCode === command.locationCode
    }

    if (command.type === 'ARRIVAL' || command.type === 'DISCHARGE') {
      return leg.podCode === command.locationCode
    }

    return false
  })

  return matches.length === 1 ? (matches[0] ?? null) : null
}

function resolveVesselContext(command: {
  readonly event: OneCopEvent
  readonly legs: readonly OneVoyageLegContext[]
  readonly locationCode: string | null
  readonly type: ObservationType
}): {
  readonly vesselName: string | null
  readonly voyage: string | null
  readonly leg: OneVoyageLegContext | null
} {
  const primaryCandidate = command.event.vessel ?? command.event.edhVessel ?? null
  if (primaryCandidate !== null) {
    const matchedLeg =
      command.legs.find((leg) => matchesLegIdentity({ leg, vessel: primaryCandidate })) ?? null
    return {
      vesselName: toTrimmedOrNull(primaryCandidate.name) ?? matchedLeg?.vesselName ?? null,
      voyage: buildCandidateVoyage(primaryCandidate) ?? matchedLeg?.voyage ?? null,
      leg: matchedLeg,
    }
  }

  const matchedLeg = findLegByLocationRole({
    legs: command.legs,
    locationCode: command.locationCode,
    type: command.type,
  })

  return {
    vesselName: matchedLeg?.vesselName ?? null,
    voyage: matchedLeg?.voyage ?? null,
    leg: matchedLeg,
  }
}

function computeConfidence(command: {
  readonly type: ObservationType
  readonly eventTime: ObservationDraft['event_time']
  readonly eventTimeType: ObservationDraft['event_time_type']
  readonly locationCode: string | null
  readonly locationDisplay: string | null
}): Confidence {
  if (command.eventTime === null) return 'low'
  if (command.type === 'OTHER') return 'medium'
  if (command.eventTimeType === 'EXPECTED') return 'medium'
  if (command.locationCode !== null || command.locationDisplay !== null) return 'high'
  return 'medium'
}

function resolveContainerNumber(command: {
  readonly rawSnapshot: OneRawSnapshot
  readonly searchContainer: OneSearchContainer | null
}): string {
  const fromSearch = toTrimmedOrNull(command.searchContainer?.containerNo)
  if (fromSearch !== null) return normalizeContainerNumber(fromSearch)
  return normalizeContainerNumber(command.rawSnapshot.requestMeta.containerNumber)
}

function buildDraftFromCopEvent(command: {
  readonly snapshot: Snapshot
  readonly rawSnapshot: OneRawSnapshot
  readonly searchContainer: OneSearchContainer | null
  readonly legs: readonly OneVoyageLegContext[]
  readonly containerNumber: string
  readonly event: OneCopEvent
}): ObservationDraft {
  const semantic = resolveOneSemanticEvent({
    matrixId: command.event.matrixId,
    eventName: command.event.eventName ?? null,
    source: 'cop',
  })
  const locationCode = normalizeCode(command.event.location?.code ?? null)
  const locationDisplay = toLocationDisplay({
    locationName: command.event.location?.locationName ?? null,
    countryName: command.event.location?.countryName ?? null,
  })
  const temporal = resolveOneEventTemporal({
    eventLocalPortDate: command.event.eventLocalPortDate,
    eventDate: command.event.eventDate,
    locationCode,
    locationDisplay,
  })
  const eventTimeType = mapOneTriggerType(command.event.triggerType)
  const vesselContext = isMaritimeEvent(semantic.type)
    ? resolveVesselContext({
        event: command.event,
        legs: command.legs,
        locationCode,
        type: semantic.type,
      })
    : { vesselName: null, voyage: null, leg: null }

  return {
    container_number: command.containerNumber,
    type: semantic.type,
    event_time: temporal.event_time,
    event_time_type: eventTimeType,
    location_code: locationCode,
    location_display: locationDisplay,
    vessel_name: vesselContext.vesselName,
    voyage: vesselContext.voyage,
    is_empty: semantic.isEmpty,
    confidence: computeConfidence({
      type: semantic.type,
      eventTime: temporal.event_time,
      eventTimeType,
      locationCode,
      locationDisplay,
    }),
    provider: 'one',
    snapshot_id: command.snapshot.id,
    carrier_label: toCarrierLabelOrNull(command.event.eventName),
    raw_event_time: temporal.raw_event_time ?? null,
    event_time_source: temporal.event_time_source ?? null,
    raw_event: {
      source: 'cop-events',
      bookingNo: command.rawSnapshot.requestMeta.bookingNo,
      copNo: command.searchContainer?.copNo ?? null,
      event: command.event,
      matchedLeg: vesselContext.leg?.raw ?? null,
    },
  }
}

function buildFallbackDraftsFromSearchCargo(command: {
  readonly snapshot: Snapshot
  readonly rawSnapshot: OneRawSnapshot
  readonly searchContainer: OneSearchContainer
  readonly containerNumber: string
  readonly locationDirectory: ReadonlyMap<string, string>
}): ObservationDraft[] {
  const drafts: ObservationDraft[] = []

  for (const cargoEvent of command.searchContainer.cargoEvents) {
    const semantic = resolveOneSemanticEvent({
      matrixId: cargoEvent.matrixId,
      source: 'search-cargo',
    })
    if (!semantic.known) {
      continue
    }

    const locationCode = resolveCargoEventLocationCode(cargoEvent, command.locationDirectory)
    const locationDisplay = toLocationDisplay({
      locationName: cargoEvent.locationName ?? null,
      countryName: cargoEvent.countryName ?? cargoEvent.countryCode ?? null,
    })
    const temporal = resolveOneEventTemporal({
      eventLocalPortDate: cargoEvent.localPortDate,
      eventDate: cargoEvent.date,
      locationCode,
      locationDisplay,
    })
    const eventTimeType = mapOneTriggerType(cargoEvent.trigger)

    drafts.push({
      container_number: command.containerNumber,
      type: semantic.type,
      event_time: temporal.event_time,
      event_time_type: eventTimeType,
      location_code: locationCode,
      location_display: locationDisplay,
      vessel_name: null,
      voyage: null,
      is_empty: semantic.isEmpty,
      confidence: computeConfidence({
        type: semantic.type,
        eventTime: temporal.event_time,
        eventTimeType,
        locationCode,
        locationDisplay,
      }),
      provider: 'one',
      snapshot_id: command.snapshot.id,
      carrier_label: null,
      raw_event_time: temporal.raw_event_time ?? null,
      event_time_source: temporal.event_time_source ?? null,
      raw_event: {
        source: 'search.cargoEvents',
        bookingNo: command.rawSnapshot.requestMeta.bookingNo,
        copNo: command.searchContainer.copNo ?? null,
        event: cargoEvent,
      },
    })
  }

  return drafts
}

export function normalizeOneSnapshot(snapshot: Snapshot): ObservationDraft[] {
  const rawSnapshotResult = OneRawSnapshotSchema.safeParse(snapshot.payload)
  if (!rawSnapshotResult.success) {
    return []
  }

  const rawSnapshot = rawSnapshotResult.data
  const searchResult = OneSearchResponseSchema.safeParse(rawSnapshot.search)
  const searchContainer =
    searchResult.success && searchResult.data.status === 200 && searchResult.data.code === 1
      ? (searchResult.data.data[0] ?? null)
      : null

  const legs = buildOneLegContexts(rawSnapshot)
  const locationDirectory = buildLocationDirectory(searchContainer, legs)
  const containerNumber = resolveContainerNumber({ rawSnapshot, searchContainer })

  const copEventsResult = OneCopEventsResponseSchema.safeParse(rawSnapshot.copEvents)
  if (
    copEventsResult.success &&
    copEventsResult.data.status === 200 &&
    copEventsResult.data.code === 1 &&
    copEventsResult.data.data.length > 0
  ) {
    return copEventsResult.data.data.map((event) =>
      buildDraftFromCopEvent({
        snapshot,
        rawSnapshot,
        searchContainer,
        legs,
        containerNumber,
        event,
      }),
    )
  }

  if (searchContainer === null || searchContainer.cargoEvents.length === 0) {
    return []
  }

  return buildFallbackDraftsFromSearchCargo({
    snapshot,
    rawSnapshot,
    searchContainer,
    containerNumber,
    locationDirectory,
  })
}
