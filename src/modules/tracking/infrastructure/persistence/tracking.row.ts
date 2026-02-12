import type { Tables, TablesInsert, TablesUpdate } from '~/shared/supabase/database.types'

// ---------------------------------------------------------------------------
// Observation rows
// ---------------------------------------------------------------------------
export type TrackingObservationRow = Tables<'container_observations'>
export type InsertTrackingObservationRow = TablesInsert<'container_observations'>
export type UpdateTrackingObservationRow = TablesUpdate<'container_observations'>

// ---------------------------------------------------------------------------
// Snapshot rows
// ---------------------------------------------------------------------------
export type TrackingSnapshotRow = Tables<'container_snapshots'>
export type InsertTrackingSnapshotRow = TablesInsert<'container_snapshots'>
export type UpdateTrackingSnapshotRow = TablesUpdate<'container_snapshots'>

// ---------------------------------------------------------------------------
// Alert rows
// ---------------------------------------------------------------------------
export type TrackingAlertRow = Tables<'tracking_alerts'>
export type InsertTrackingAlertRow = TablesInsert<'tracking_alerts'>
export type UpdateTrackingAlertRow = TablesUpdate<'tracking_alerts'>
