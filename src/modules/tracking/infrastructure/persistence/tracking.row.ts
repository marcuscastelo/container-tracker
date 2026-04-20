import type { Tables, TablesInsert } from '~/shared/supabase/database.types'

// ---------------------------------------------------------------------------
// Observation rows
// ---------------------------------------------------------------------------
export type TrackingObservationRow = Tables<'container_observations'>
export type InsertTrackingObservationRow = TablesInsert<'container_observations'>

// ---------------------------------------------------------------------------
// Snapshot rows
// ---------------------------------------------------------------------------
export type TrackingSnapshotRow = Tables<'container_snapshots'>
export type InsertTrackingSnapshotRow = TablesInsert<'container_snapshots'>

// ---------------------------------------------------------------------------
// Alert rows
// ---------------------------------------------------------------------------
export type TrackingAlertRow = Tables<'tracking_alerts'>
export type InsertTrackingAlertRow = TablesInsert<'tracking_alerts'>

// ---------------------------------------------------------------------------
// Tracking validation lifecycle rows
// ---------------------------------------------------------------------------
export type TrackingValidationLifecycleRow = Tables<'tracking_validation_issue_transitions'>
export type InsertTrackingValidationLifecycleRow =
  TablesInsert<'tracking_validation_issue_transitions'>
