export type InstantDto = { readonly kind: 'instant'; readonly value: string }
export type CalendarDateDto = { readonly kind: 'date'; readonly value: string }
export type TemporalValueDto = InstantDto | CalendarDateDto
