import { createHash } from 'node:crypto'

/**
 * Computes a deterministic fingerprint for a FACT-based alert.
 *
 * Purpose:
 *   - Prevent duplicate FACT alerts when the same semantic fact is re-derived
 *   - Allow multiple distinct FACT alerts of the same TYPE (e.g., two different transshipments)
 *
 * Strategy:
 *   - Fingerprint is based on alert type + sorted evidence (observation fingerprints)
 *   - Two alerts with identical type and identical evidence → same fingerprint (duplicate)
 *   - Two alerts with same type but different evidence → different fingerprints (legitimate)
 *
 * IMPORTANT:
 *   - This function is ONLY for FACT alerts
 *   - Evidence fingerprints MUST be sorted to ensure determinism
 *
 * Example:
 *   - Transshipment A: LOAD@POL → DISCHARGE@TRANSSHIP → LOAD@TRANSSHIP → DISCHARGE@POD
 *   - Transshipment B: LOAD@POL → DISCHARGE@OTHER → LOAD@OTHER → DISCHARGE@POD
 *   → Different observation fingerprints → different alert fingerprints → both alerts exist
 *
 * @param type - The alert type (e.g., "TRANSSHIPMENT", "CUSTOMS_HOLD")
 * @param evidenceFingerprints - Array of observation fingerprints that triggered this alert
 * @returns A deterministic 32-character hex fingerprint
 *
 * @see docs/master-consolidated-0209.md §4.2.1
 * @see src/modules/tracking/domain/identity/fingerprint.ts (observation fingerprint)
 */
export function computeAlertFingerprint(
  type: string,
  evidenceFingerprints: readonly string[],
): string {
  // Sort evidence fingerprints to ensure determinism regardless of observation order
  const sortedEvidence = [...evidenceFingerprints].sort()

  // Canonical representation: type + joined evidence
  const canonical = `${type}:${sortedEvidence.join(',')}`

  // Generate SHA-256 hash and truncate to 32 characters (same as observation fingerprint)
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

/**
 * Computes deterministic fingerprint for NO_MOVEMENT monitoring episodes.
 *
 * Episode identity:
 *   - container_id
 *   - alert type
 *   - breakpoint threshold_days
 *   - cycle anchor key (latest ACTUAL event identity for stagnation cycle)
 *
 * Including the cycle anchor allows the same breakpoint to be emitted again
 * after a new ACTUAL movement resets stagnation progression.
 */
export function computeNoMovementAlertFingerprint(
  containerId: string,
  thresholdDays: number,
  cycleAnchorKey: string,
): string {
  const canonical = `NO_MOVEMENT:${containerId}:${thresholdDays}:${cycleAnchorKey}`
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}
