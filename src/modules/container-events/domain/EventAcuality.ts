import z from 'zod/v4'

export const EventActualitySchema = z.enum(['UNKNOWN', 'ACTUAL', 'EXPECTED'])

export type EventActuality = z.infer<typeof EventActualitySchema>
