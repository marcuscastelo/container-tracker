# Event Series Classification Implementation Summary

## Overview

Implemented comprehensive event series classification enhancement for the Container Tracker platform, adding safe-first conflict detection and redundant EXPECTED event handling as specified in the addendum.

## Files Created/Modified

### New Files

1. **`src/modules/tracking/domain/seriesClassification.ts`** (244 lines)
   - Core classification logic with deterministic safe-first rules
   - `classifySeries()`: Main classification function
   - `SeriesLabel` type: ACTIVE, EXPIRED, REDUNDANT_AFTER_ACTUAL, SUPERSEDED_EXPECTED, CONFIRMED, CONFLICTING_ACTUAL
   - Helper functions: `getSeriesLabelKey()`, `getSeriesLabelClass()`
   - Zero persistence changes (projection-only)

2. **`src/modules/tracking/domain/tests/seriesClassification.test.ts`** (427 lines)
   - Comprehensive test coverage (23 test cases, all passing)
   - Tests for EXPECTED progression, ACTUAL conflicts, edge cases
   - Real-world scenario tests (carrier API quirks, backfill conflicts)
   - 100% coverage of classification rules

### Modified Files

1. **`src/modules/process/ui/components/PredictionHistoryModal.tsx`**
   - Integrated `classifySeries()` for real-time classification
   - Added conflict warning UI in modal header (red alert badge)
   - Updated table to show derived labels with proper styling
   - Added "Status" column with color-coded badges
   - Removed old manual badge logic

2. **`src/modules/tracking/application/tracking.timeline.presenter.ts`**
   - Updated `deriveTimelineWithSeries()` to use canonical classification
   - Simplified primary selection logic (delegates to `classifySeries()`)
   - Added safe-first conflict detection comments

3. **Locale Files** (en-US, pt-BR, pt-PT)
   - Added new keys:
     - `shipmentView.timeline.predictionHistory.status`
     - `shipmentView.timeline.predictionHistory.redundant`
     - `shipmentView.timeline.predictionHistory.superseded`
     - `shipmentView.timeline.predictionHistory.conflicting`
     - `shipmentView.timeline.predictionHistory.conflictWarning`
     - `shipmentView.timeline.predictionHistory.conflictHelper`

## Key Features Implemented

### 1. EXPECTED Post-ACTUAL Classification (Rule E1)

**Rule**: EXPECTED entries with `event_time >= lastActualTime` are marked as `REDUNDANT_AFTER_ACTUAL`.

**Rationale**: Once an event is confirmed (ACTUAL), subsequent carrier predictions for the same milestone are operationally meaningless (API quirks/delayed cache).

**Example**:
```
Series: DEPARTURE @ Port A
  - EXPECTED 2026-01-05  → SUPERSEDED
  - EXPECTED 2026-01-10  → SUPERSEDED
  - ACTUAL   2026-01-12  → CONFIRMED (primary)
  - EXPECTED 2026-01-15  → REDUNDANT_AFTER_ACTUAL ✓
  - EXPECTED 2026-01-18  → REDUNDANT_AFTER_ACTUAL ✓
```

### 2. Conflicting ACTUAL Detection (Safe-First)

**Rule**: When multiple ACTUAL entries exist in a series, select latest by `event_time` (tie-breaker: `created_at`).

**Detection**: Sets `hasActualConflict: true`, `conflictingActualCount: N-1`.

**UI Warning**: Shows red alert badge in modal header:
- "Multiple confirmed events detected"
- "For safety, we're showing the most recent event. Please review the history below."

**Example**:
```
Series: ARRIVAL @ POD
  - ACTUAL 2026-01-10  → CONFLICTING_ACTUAL
  - ACTUAL 2026-01-12  → CONFLICTING_ACTUAL
  - ACTUAL 2026-01-15  → CONFIRMED (primary, latest) ✓
```

### 3. Superseded EXPECTED Classification

**Rule**: EXPECTED entries before ACTUAL are marked `SUPERSEDED_EXPECTED` (not EXPIRED), because they were confirmed by the ACTUAL.

**Rule 2**: When an active EXPECTED exists, older EXPECTED entries are `SUPERSEDED_EXPECTED` (not EXPIRED).

**Example**:
```
Series: Only EXPECTED, no ACTUAL
  - EXPECTED 2025-12-01  → SUPERSEDED_EXPECTED (not EXPIRED)
  - EXPECTED 2026-03-01  → ACTIVE ✓
```

### 4. Main Timeline Primary Selection

**Rule**: Primary is always the latest ACTUAL if any exists, otherwise latest valid (non-expired, non-redundant) EXPECTED.

**Precedence**: ACTUAL > active EXPECTED > (nothing if all EXPECTED are expired/redundant)

### 5. Null `event_time` Handling

- ACTUAL with null `event_time`: Uses `created_at` for comparison
- EXPECTED with null `event_time`: Treated as active (not expired)
- Conflict detection: Works correctly with null times

## Test Coverage

All 23 tests passing (133 total in tracking domain):

- Empty and single observation cases ✓
- EXPECTED progression without ACTUAL ✓
- EXPECTED then ACTUAL (Rules E1 & E2) ✓
- Multiple ACTUAL (conflict detection) ✓
- Mixed EXPECTED and multiple ACTUAL ✓
- Real-world scenarios ✓
- Null event_time handling ✓
- Primary selection rules ✓

## Acceptance Criteria

✅ EXPECTED entries after ACTUAL labeled as redundant/invalid in history
✅ Series with 2+ ACTUAL shows warning and labels non-primary as conflicting
✅ Main timeline stays clean (primary = latest ACTUAL)
✅ No persistence changes (projection-only)
✅ Deterministic (uses only event_time, event_time_type, created_at, series key)
✅ i18n keys added to all locales
✅ Conflict warning UI implemented
✅ All existing tests still pass

## Architecture

- **Domain Layer**: Pure classification logic (`seriesClassification.ts`)
- **Application Layer**: Timeline presenter uses classification for primary selection
- **UI Layer**: Modal consumes classification for display
- **No Database Changes**: Entirely projection-level

## Notes

- Classification is runtime-only, not persisted
- Follows safe-first principle (latest ACTUAL always wins)
- Handles carrier API quirks (redundant EXPECTED, conflicting backfills)
- Preserves full prediction history for auditability
- Conflict warning provides user visibility without blocking

## Future Enhancements (Out of Scope)

- Filtering/compaction for backfills
- User-configurable conflict resolution rules
- Automated conflict alerts (email/webhook)
- Historical conflict analysis dashboard
