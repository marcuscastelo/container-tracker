import { z } from 'zod'

/*
  Zod schema for MSC API response (based on examples/msc.json)
  - Captures Data.BillOfLadings -> ContainersInfo -> Events[] structure
  - Dates are in DD/MM/YYYY format in examples and may lack time information
*/

export const MscVesselSchema = z.object({
  IMO: z.string().nullable().optional(),
  Flag: z.string().nullable().optional(),
  Built: z.string().nullable().optional(),
  FlagName: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const MscEventSchema = z.object({
  Date: z.string().nullable().optional(), // e.g. "02/02/2026"
  Order: z.number().nullable().optional(),
  Detail: z.array(z.string()).nullable().optional(), // often [vesselName, voyage]
  Vessel: MscVesselSchema.nullable().optional(),
  Location: z.string().nullable().optional(),
  Description: z.string().nullable().optional(),
  UnLocationCode: z.string().nullable().optional(),
  EquipmentHandling: z.any().nullable().optional(),
  IntermediaryPortCalls: z.any().nullable().optional(),
  raw: z.any().optional(),
})

export const MscContainerInfoSchema = z.object({
  Events: z.array(MscEventSchema).optional(),
  Delivered: z.boolean().nullable().optional(),
  LatestMove: z.string().nullable().optional(),
  PodEtaDate: z.string().nullable().optional(),
  ContainerType: z.string().nullable().optional(),
  ContainerNumber: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const MscBillOfLadingSchema = z.object({
  Delivered: z.boolean().nullable().optional(),
  ContainersInfo: z.array(MscContainerInfoSchema).optional(),
  BillOfLadingNumber: z.string().nullable().optional(),
  NumberOfContainers: z.number().nullable().optional(),
  GeneralTrackingInfo: z.any().nullable().optional(),
  raw: z.any().optional(),
})

export const MscDataSchema = z.object({
  CurrentDate: z.string().nullable().optional(),
  TrackingType: z.string().nullable().optional(),
  BillOfLadings: z.array(MscBillOfLadingSchema).optional(),
  TrackingTitle: z.string().nullable().optional(),
  TrackingNumber: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const MscApiSchema = z.object({
  Data: MscDataSchema.optional(),
  IsSuccess: z.boolean().nullable().optional(),
  raw: z.any().optional(),
})

export type MscApi = z.infer<typeof MscApiSchema>
