/**
 * Canonical observation types — semantic event categories.
 *
 * These are internal, provider-agnostic categories.
 * Adapters map provider-specific descriptions to these.
 *
 * @see docs/master-consolidated-0209.md §2.4
 */
export type ObservationType =
  /** Container received at container yard (export) */
  | 'GATE_IN'
  /** Container released from yard */
  | 'GATE_OUT'
  /** Container loaded onto vessel */
  | 'LOAD'
  /** Container discharged from vessel */
  | 'DISCHARGE'
  /** Vessel departed port */
  | 'DEPARTURE'
  /** Vessel arrived at port */
  | 'ARRIVAL'
  /** Customs hold event */
  | 'CUSTOMS_HOLD'
  /** Customs release event */
  | 'CUSTOMS_RELEASE'
  /** Container delivered to consignee */
  | 'DELIVERY'
  /** Empty container returned */
  | 'EMPTY_RETURN'
  /** Catch-all for unmapped events */
  | 'OTHER'
