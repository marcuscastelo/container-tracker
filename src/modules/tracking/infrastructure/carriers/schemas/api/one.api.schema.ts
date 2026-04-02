import { z } from 'zod'

const NullableTextSchema = z.string().trim().min(1).nullable().optional()

export const OneSearchLocationSchema = z
  .object({
    code: NullableTextSchema,
    locationName: NullableTextSchema,
    countryName: NullableTextSchema,
  })
  .passthrough()

export type OneSearchLocation = z.infer<typeof OneSearchLocationSchema>

export const OneSearchCargoEventSchema = z
  .object({
    matrixId: z.string().trim().min(1),
    locationName: NullableTextSchema,
    countryCode: NullableTextSchema,
    countryName: NullableTextSchema,
    date: NullableTextSchema,
    localPortDate: NullableTextSchema,
    trigger: NullableTextSchema,
  })
  .passthrough()

export type OneSearchCargoEvent = z.infer<typeof OneSearchCargoEventSchema>

export const OneSearchVesselVoyageSchema = z
  .object({
    vesselCode: NullableTextSchema,
    vesselName: NullableTextSchema,
    voyageNo: NullableTextSchema,
    directionCode: NullableTextSchema,
  })
  .passthrough()

export type OneSearchVesselVoyage = z.infer<typeof OneSearchVesselVoyageSchema>

export const OneSearchLatestEventSchema = z
  .object({
    eventName: NullableTextSchema,
    locationName: NullableTextSchema,
    date: NullableTextSchema,
  })
  .passthrough()

export type OneSearchLatestEvent = z.infer<typeof OneSearchLatestEventSchema>

export const OneSearchContainerSchema = z
  .object({
    bookingNo: NullableTextSchema,
    containerNo: NullableTextSchema,
    por: OneSearchLocationSchema.nullable().optional(),
    pod: OneSearchLocationSchema.nullable().optional(),
    latestEvent: OneSearchLatestEventSchema.nullable().optional(),
    cargoEvents: z.array(OneSearchCargoEventSchema).optional().default([]),
    vesselVoyage: OneSearchVesselVoyageSchema.nullable().optional(),
    copNo: NullableTextSchema,
  })
  .passthrough()

export type OneSearchContainer = z.infer<typeof OneSearchContainerSchema>

export const OneSearchResponseSchema = z
  .object({
    status: z.number().int(),
    code: z.number().int(),
    message: z.string(),
    total: z.number().int().nullable().optional(),
    data: z.array(OneSearchContainerSchema),
  })
  .passthrough()

export type OneSearchResponse = z.infer<typeof OneSearchResponseSchema>

export const OneVoyagePortSchema = z
  .object({
    locationName: NullableTextSchema,
    locationCode: NullableTextSchema,
    date: NullableTextSchema,
    isActual: z.boolean().nullable().optional(),
    isArrivalActual: z.boolean().nullable().optional(),
    arrivalDate: NullableTextSchema,
    isBerthingActual: z.boolean().nullable().optional(),
    berthingDate: NullableTextSchema,
  })
  .passthrough()

export type OneVoyagePort = z.infer<typeof OneVoyagePortSchema>

export const OneVoyageLegSchema = z
  .object({
    vesselCode: NullableTextSchema,
    vesselEngName: NullableTextSchema,
    scheduleVoyageNumber: NullableTextSchema,
    scheduleDirectionCode: NullableTextSchema,
    pol: OneVoyagePortSchema.nullable().optional(),
    pod: OneVoyagePortSchema.nullable().optional(),
    arrivalDate: NullableTextSchema,
    berthingDate: NullableTextSchema,
    inboundConsortiumVoyage: NullableTextSchema,
    outboundConsortiumVoyage: NullableTextSchema,
  })
  .passthrough()

export type OneVoyageLeg = z.infer<typeof OneVoyageLegSchema>

export const OneVoyageListResponseSchema = z
  .object({
    status: z.number().int(),
    code: z.number().int(),
    message: z.string(),
    data: z.array(OneVoyageLegSchema),
  })
  .passthrough()

export type OneVoyageListResponse = z.infer<typeof OneVoyageListResponseSchema>

export const OneCopLocationSchema = z
  .object({
    code: NullableTextSchema,
    locationName: NullableTextSchema,
    countryName: NullableTextSchema,
  })
  .passthrough()

export type OneCopLocation = z.infer<typeof OneCopLocationSchema>

export const OneCopYardSchema = z
  .object({
    yardCode: NullableTextSchema,
    yardName: NullableTextSchema,
  })
  .passthrough()

export type OneCopYard = z.infer<typeof OneCopYardSchema>

export const OneCopVesselSchema = z
  .object({
    code: NullableTextSchema,
    name: NullableTextSchema,
    voyNo: NullableTextSchema,
    dirCode: NullableTextSchema,
  })
  .passthrough()

export type OneCopVessel = z.infer<typeof OneCopVesselSchema>

export const OneCopEdhVesselSchema = z
  .object({
    code: NullableTextSchema,
    name: NullableTextSchema,
    voyNo: NullableTextSchema,
    dirCode: NullableTextSchema,
    isShowVesselInformation: z.boolean().nullable().optional(),
    inboundConsortiumVoyage: NullableTextSchema,
    outboundConsortiumVoyage: NullableTextSchema,
  })
  .passthrough()

export type OneCopEdhVessel = z.infer<typeof OneCopEdhVesselSchema>

export const OneCopEventSchema = z
  .object({
    eventName: NullableTextSchema,
    matrixId: z.string().trim().min(1),
    triggerType: NullableTextSchema,
    eventDate: NullableTextSchema,
    eventLocalPortDate: NullableTextSchema,
    location: OneCopLocationSchema.nullable().optional(),
    yard: OneCopYardSchema.nullable().optional(),
    vessel: OneCopVesselSchema.nullable().optional(),
    edhVessel: OneCopEdhVesselSchema.nullable().optional(),
    copSequence: z.number().int().nullable().optional(),
  })
  .passthrough()

export type OneCopEvent = z.infer<typeof OneCopEventSchema>

export const OneCopEventsResponseSchema = z
  .object({
    status: z.number().int(),
    code: z.number().int(),
    message: z.string(),
    data: z.array(OneCopEventSchema),
  })
  .passthrough()

export type OneCopEventsResponse = z.infer<typeof OneCopEventsResponseSchema>

export const OneEndpointMetaSchema = z.object({
  ok: z.boolean(),
  statusCode: z.number().int().nullable(),
  error: z.string().nullable(),
  receivedCount: z.number().int().nonnegative().nullable(),
})

export type OneEndpointMeta = z.infer<typeof OneEndpointMetaSchema>

export const OneRawSnapshotSchema = z.object({
  provider: z.literal('one'),
  search: z.unknown().nullable(),
  voyageList: z.unknown().nullable(),
  copEvents: z.unknown().nullable(),
  requestMeta: z.object({
    containerNumber: z.string().trim().min(1),
    bookingNo: z.string().trim().min(1).nullable(),
  }),
  endpointMeta: z.object({
    search: OneEndpointMetaSchema,
    voyageList: OneEndpointMetaSchema,
    copEvents: OneEndpointMetaSchema,
  }),
})

export type OneRawSnapshot = z.infer<typeof OneRawSnapshotSchema>
