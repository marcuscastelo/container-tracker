import type { Tables, TablesInsert, TablesUpdate } from '~/shared/supabase/database.types'

export type TrackingReplayRunRow = Tables<'tracking_replay_runs'>
export type InsertTrackingReplayRunRow = TablesInsert<'tracking_replay_runs'>
export type UpdateTrackingReplayRunRow = TablesUpdate<'tracking_replay_runs'>

export type TrackingReplayRunTargetRow = Tables<'tracking_replay_run_targets'>
export type InsertTrackingReplayRunTargetRow = TablesInsert<'tracking_replay_run_targets'>
export type UpdateTrackingReplayRunTargetRow = TablesUpdate<'tracking_replay_run_targets'>

export type TrackingDerivationGenerationRow = Tables<'tracking_derivation_generations'>
export type InsertTrackingDerivationGenerationRow = TablesInsert<'tracking_derivation_generations'>
export type UpdateTrackingDerivationGenerationRow = TablesUpdate<'tracking_derivation_generations'>

export type TrackingGenerationPointerRow = Tables<'tracking_generation_pointers'>
export type InsertTrackingGenerationPointerRow = TablesInsert<'tracking_generation_pointers'>
export type UpdateTrackingGenerationPointerRow = TablesUpdate<'tracking_generation_pointers'>

export type TrackingReplayLockRow = Tables<'tracking_replay_locks'>

export type ActiveContainerObservationRow = Tables<'active_container_observations'>
export type ActiveTrackingAlertRow = Tables<'active_tracking_alerts'>
