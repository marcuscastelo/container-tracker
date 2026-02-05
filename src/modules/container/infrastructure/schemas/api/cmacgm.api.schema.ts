import { z } from 'zod'

/*
  Zod schema for CMA CGM API (based on examples/cmagcm.json)
  - Models moves (past/current/provisional) and top-level ETA / container reference
  - Many provider-specific numeric status codes are preserved in `status`/`status_code`
*/

// Move item used in PastMoves / CurrentMoves / ProvisionalMoves
export const CmaCgmMoveSchema = z.object({
  Date: z.string().nullable().optional(), // MS "\/Date(1764659520000)\/" format in examples
  State: z.string().nullable().optional(), // e.g. DONE, CURRENT, NONE
  Status: z.number().nullable().optional(), // numeric provider code
  Vessel: z.string().nullable().optional(),
  Voyage: z.string().nullable().optional(),
  Location: z.string().nullable().optional(),
  VesselId: z.string().nullable().optional(),
  DateString: z.string().nullable().optional(),
  TimeString: z.string().nullable().optional(),
  VesselCode: z.string().nullable().optional(),
  VoyageLink: z.string().nullable().optional(),
  LocationCode: z.string().nullable().optional(),
  ModeOfTransport: z.string().nullable().optional(), // TRUCK | RAIL | VESSEL
  LocationTerminal: z.string().nullable().optional(),
  StatusDescription: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export const CmaCgmApiSchema = z.object({
  ContainerReference: z.string().nullable().optional(),
  EstimatedTimeOfArrival: z.string().nullable().optional(), // "/Date(...)\/"
  ABPExportDate: z.string().nullable().optional(),
  ABPImportDate: z.string().nullable().optional(),
  CurrentMoves: z.array(CmaCgmMoveSchema).optional(),
  PastMoves: z.array(CmaCgmMoveSchema).optional(),
  ProvisionalMoves: z.array(CmaCgmMoveSchema).optional(),
  PlaceOfLoading: z.string().nullable().optional(),
  LastDischargePort: z.string().nullable().optional(),
  ContainerStatus: z.number().nullable().optional(),
  IsEtaAtPod: z.boolean().nullable().optional(),
  IsEtaAtFpd: z.boolean().nullable().optional(),
  ContextInfo: z.any().optional(),
  CollectionAddress: z.any().optional(),
  LaraContainerCode: z.string().nullable().optional(),
  RemainingDays: z.number().nullable().optional(),
  DefaultZoomLevel: z.number().nullable().optional(),
  ModeOfTransport: z.string().nullable().optional(),
  EstimatedTimeOfArrivalString: z.string().nullable().optional(),
  raw: z.any().optional(),
})

export type CmaCgmApi = z.infer<typeof CmaCgmApiSchema>
