export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      agent_enrollment_audit_events: {
        Row: {
          created_at: string
          event_type: string
          hostname: string | null
          id: string
          ip_address: string | null
          machine_fingerprint: string | null
          reason: string | null
          status_code: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          machine_fingerprint?: string | null
          reason?: string | null
          status_code: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          hostname?: string | null
          id?: string
          ip_address?: string | null
          machine_fingerprint?: string | null
          reason?: string | null
          status_code?: number
          tenant_id?: string | null
        }
        Relationships: []
      }
      agent_install_tokens: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          revoked_at: string | null
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          revoked_at?: string | null
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_log_events: {
        Row: {
          agent_id: string
          channel: string
          created_at: string
          id: string
          message: string
          occurred_at: string
          sequence: number
          tenant_id: string
          truncated: boolean
        }
        Insert: {
          agent_id: string
          channel: string
          created_at?: string
          id?: string
          message: string
          occurred_at?: string
          sequence: number
          tenant_id: string
          truncated?: boolean
        }
        Update: {
          agent_id?: string
          channel?: string
          created_at?: string
          id?: string
          message?: string
          occurred_at?: string
          sequence?: number
          tenant_id?: string
          truncated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'agent_log_events_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'tracking_agents'
            referencedColumns: ['id']
          },
        ]
      }
      agent_control_commands: {
        Row: {
          acknowledgement_detail: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledged_status: string | null
          agent_id: string
          command_type: string
          created_at: string
          id: string
          payload: Json
          requested_at: string
          requested_by: string | null
          tenant_id: string
        }
        Insert: {
          acknowledgement_detail?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledged_status?: string | null
          agent_id: string
          command_type: string
          created_at?: string
          id?: string
          payload?: Json
          requested_at?: string
          requested_by?: string | null
          tenant_id: string
        }
        Update: {
          acknowledgement_detail?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledged_status?: string | null
          agent_id?: string
          command_type?: string
          created_at?: string
          id?: string
          payload?: Json
          requested_at?: string
          requested_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'agent_control_commands_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'tracking_agents'
            referencedColumns: ['id']
          },
        ]
      }
      container_observations: {
        Row: {
          carrier_label: string | null
          confidence: string
          container_id: string
          container_number: string
          created_at: string
          created_from_snapshot_id: string | null
          derivation_generation_id: string
          event_date: string | null
          event_time_local: string | null
          event_time_source: string | null
          event_time_zone: string | null
          /**
           * @deprecated
           */
          event_time: string | null
          event_time_instant: string | null
          event_time_type: string
          fingerprint: string
          id: string
          is_empty: boolean | null
          location_code: string | null
          location_display: string | null
          provider: string
          raw_event_time: string | null
          retroactive: boolean
          temporal_kind: string | null
          type: string
          vessel_name: string | null
          voyage: string | null
        }
        Insert: {
          carrier_label?: string | null
          confidence: string
          container_id: string
          container_number: string
          created_at?: string
          created_from_snapshot_id?: string | null
          derivation_generation_id?: string
          event_date?: string | null
          event_time_local?: string | null
          event_time_source?: string | null
          event_time_zone?: string | null
          event_time?: string | null
          event_time_instant?: string | null
          event_time_type: string
          fingerprint: string
          id?: string
          is_empty?: boolean | null
          location_code?: string | null
          location_display?: string | null
          provider: string
          raw_event_time?: string | null
          retroactive?: boolean
          temporal_kind?: string | null
          type: string
          vessel_name?: string | null
          voyage?: string | null
        }
        Update: {
          carrier_label?: string | null
          confidence?: string
          container_id?: string
          container_number?: string
          created_at?: string
          created_from_snapshot_id?: string | null
          derivation_generation_id?: string
          event_date?: string | null
          event_time_local?: string | null
          event_time_source?: string | null
          event_time_zone?: string | null
          event_time?: string | null
          event_time_instant?: string | null
          event_time_type?: string
          fingerprint?: string
          id?: string
          is_empty?: boolean | null
          location_code?: string | null
          location_display?: string | null
          provider?: string
          raw_event_time?: string | null
          retroactive?: boolean
          temporal_kind?: string | null
          type?: string
          vessel_name?: string | null
          voyage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'container_observations_container_id_fkey'
            columns: ['container_id']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'container_observations_created_from_snapshot_id_fkey'
            columns: ['created_from_snapshot_id']
            isOneToOne: false
            referencedRelation: 'container_snapshots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'container_observations_derivation_generation_id_fkey'
            columns: ['derivation_generation_id']
            isOneToOne: false
            referencedRelation: 'tracking_derivation_generations'
            referencedColumns: ['id']
          },
        ]
      }
      container_snapshots: {
        Row: {
          container_id: string
          fetched_at: string
          id: string
          parse_error: string | null
          payload: Json
          provider: string
        }
        Insert: {
          container_id?: string
          fetched_at: string
          id?: string
          parse_error?: string | null
          payload: Json
          provider: string
        }
        Update: {
          container_id?: string
          fetched_at?: string
          id?: string
          parse_error?: string | null
          payload?: Json
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: 'container_snapshots_container_id_fkey'
            columns: ['container_id']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
        ]
      }
      containers: {
        Row: {
          carrier_code: string
          container_number: string
          container_size: string | null
          container_type: string | null
          created_at: string
          id: string
          process_id: string
          removed_at: string | null
        }
        Insert: {
          carrier_code: string
          container_number: string
          container_size?: string | null
          container_type?: string | null
          created_at?: string
          id?: string
          process_id?: string
          removed_at?: string | null
        }
        Update: {
          carrier_code?: string
          container_number?: string
          container_size?: string | null
          container_type?: string | null
          created_at?: string
          id?: string
          process_id?: string
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'containers_process_id_fkey'
            columns: ['process_id']
            isOneToOne: false
            referencedRelation: 'processes'
            referencedColumns: ['id']
          },
        ]
      }
      processes: {
        Row: {
          archived_at: string | null
          bill_of_lading: string | null
          booking_number: string | null
          booking_reference: string | null
          carrier: string | null
          client_id: string | null
          created_at: string | null
          deleted_at: string | null
          destination: Json | null
          depositary: string | null
          exporter_name: string | null
          id: string
          importer_name: string | null
          origin: Json | null
          product: string | null
          redestination_number: string | null
          reference: string | null
          reference_importer: string | null
          source: string
          updated_at: string | null
        }
        Insert: {
          archived_at?: string | null
          bill_of_lading?: string | null
          booking_number?: string | null
          booking_reference?: string | null
          carrier?: string | null
          client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          destination?: Json | null
          depositary?: string | null
          exporter_name?: string | null
          id?: string
          importer_name?: string | null
          origin?: Json | null
          product?: string | null
          redestination_number?: string | null
          reference?: string | null
          reference_importer?: string | null
          source: string
          updated_at?: string | null
        }
        Update: {
          archived_at?: string | null
          bill_of_lading?: string | null
          booking_number?: string | null
          booking_reference?: string | null
          carrier?: string | null
          client_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          destination?: Json | null
          depositary?: string | null
          exporter_name?: string | null
          id?: string
          importer_name?: string | null
          origin?: Json | null
          product?: string | null
          redestination_number?: string | null
          reference?: string | null
          reference_importer?: string | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_requests: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          leased_by: string | null
          leased_until: string | null
          priority: number
          provider: string
          ref_type: string
          ref_value: string
          status: Database['public']['Enums']['sync_request_status']
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          leased_by?: string | null
          leased_until?: string | null
          priority?: number
          provider: string
          ref_type: string
          ref_value: string
          status?: Database['public']['Enums']['sync_request_status']
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          leased_by?: string | null
          leased_until?: string | null
          priority?: number
          provider?: string
          ref_type?: string
          ref_value?: string
          status?: Database['public']['Enums']['sync_request_status']
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracking_agent_activity_events: {
        Row: {
          agent_id: string
          created_at: string
          event_type: string
          id: string
          message: string
          metadata: Json
          occurred_at: string
          severity: string
          tenant_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          event_type: string
          id?: string
          message: string
          metadata?: Json
          occurred_at?: string
          severity?: string
          tenant_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          metadata?: Json
          occurred_at?: string
          severity?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_agent_activity_events_agent_id_fkey'
            columns: ['agent_id']
            isOneToOne: false
            referencedRelation: 'tracking_agents'
            referencedColumns: ['id']
          },
        ]
      }
      tracking_agents: {
        Row: {
          active_jobs: number
          agent_token: string
          agent_version: string
          boot_status: string
          capabilities: Json
          created_at: string
          current_version: string
          desired_version: string | null
          enrolled_at: string
          enrollment_method: string | null
          hostname: string
          id: string
          interval_sec: number
          last_enrolled_at: string
          last_error: string | null
          last_log_at: string | null
          last_seen_at: string | null
          lease_health: string
          logs_supported: boolean
          machine_fingerprint: string
          maersk_enabled: boolean
          maersk_headless: boolean
          maersk_timeout_ms: number
          maersk_user_data_dir: string | null
          max_concurrent: number
          os: string
          processing_state: string
          queue_lag_seconds: number | null
          realtime_state: string
          remote_blocked_versions: string[]
          remote_updates_paused: boolean
          restart_requested_at: string | null
          revoked_at: string | null
          status: string
          supabase_anon_key: string | null
          supabase_url: string | null
          tenant_id: string
          token_id_masked: string | null
          update_channel: string
          update_ready_version: string | null
          updated_at: string
          updater_last_checked_at: string | null
          updater_last_error: string | null
          updater_state: string
        }
        Insert: {
          active_jobs?: number
          agent_token: string
          agent_version: string
          boot_status?: string
          capabilities?: Json
          created_at?: string
          current_version?: string
          desired_version?: string | null
          enrolled_at?: string
          enrollment_method?: string | null
          hostname: string
          id?: string
          interval_sec?: number
          last_enrolled_at?: string
          last_error?: string | null
          last_log_at?: string | null
          last_seen_at?: string | null
          lease_health?: string
          logs_supported?: boolean
          machine_fingerprint: string
          maersk_enabled?: boolean
          maersk_headless?: boolean
          maersk_timeout_ms?: number
          maersk_user_data_dir?: string | null
          max_concurrent?: number
          os: string
          processing_state?: string
          queue_lag_seconds?: number | null
          realtime_state?: string
          remote_blocked_versions?: string[]
          remote_updates_paused?: boolean
          restart_requested_at?: string | null
          revoked_at?: string | null
          status?: string
          supabase_anon_key?: string | null
          supabase_url?: string | null
          tenant_id: string
          token_id_masked?: string | null
          update_channel?: string
          update_ready_version?: string | null
          updated_at?: string
          updater_last_checked_at?: string | null
          updater_last_error?: string | null
          updater_state?: string
        }
        Update: {
          active_jobs?: number
          agent_token?: string
          agent_version?: string
          boot_status?: string
          capabilities?: Json
          created_at?: string
          current_version?: string
          desired_version?: string | null
          enrolled_at?: string
          enrollment_method?: string | null
          hostname?: string
          id?: string
          interval_sec?: number
          last_enrolled_at?: string
          last_error?: string | null
          last_log_at?: string | null
          last_seen_at?: string | null
          lease_health?: string
          logs_supported?: boolean
          machine_fingerprint?: string
          maersk_enabled?: boolean
          maersk_headless?: boolean
          maersk_timeout_ms?: number
          maersk_user_data_dir?: string | null
          max_concurrent?: number
          os?: string
          processing_state?: string
          queue_lag_seconds?: number | null
          realtime_state?: string
          remote_blocked_versions?: string[]
          remote_updates_paused?: boolean
          restart_requested_at?: string | null
          revoked_at?: string | null
          status?: string
          supabase_anon_key?: string | null
          supabase_url?: string | null
          tenant_id?: string
          token_id_masked?: string | null
          update_channel?: string
          update_ready_version?: string | null
          updated_at?: string
          updater_last_checked_at?: string | null
          updater_last_error?: string | null
          updater_state?: string
        }
        Relationships: []
      }
      tracking_alerts: {
        Row: {
          acked_at: string | null
          acked_by: string | null
          acked_source: string | null
          alert_fingerprint: string | null
          category: string
          container_id: string
          created_at: string
          detected_at: string
          derivation_generation_id: string
          id: string
          lifecycle_state: string
          message_key: string
          message_params: Json
          provider: string | null
          resolved_at: string | null
          resolved_reason: string | null
          retroactive: boolean
          severity: string
          source_observation_fingerprints: Json
          triggered_at: string
          type: string
        }
        Insert: {
          acked_at?: string | null
          acked_by?: string | null
          acked_source?: string | null
          alert_fingerprint?: string | null
          category: string
          container_id?: string
          created_at?: string
          detected_at: string
          derivation_generation_id?: string
          id?: string
          lifecycle_state?: string
          message_key: string
          message_params?: Json
          provider?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          retroactive: boolean
          severity: string
          source_observation_fingerprints: Json
          triggered_at: string
          type: string
        }
        Update: {
          acked_at?: string | null
          acked_by?: string | null
          acked_source?: string | null
          alert_fingerprint?: string | null
          category?: string
          container_id?: string
          created_at?: string
          detected_at?: string
          derivation_generation_id?: string
          id?: string
          lifecycle_state?: string
          message_key?: string
          message_params?: Json
          provider?: string | null
          resolved_at?: string | null
          resolved_reason?: string | null
          retroactive?: boolean
          severity?: string
          source_observation_fingerprints?: Json
          triggered_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_alerts_container_id_fkey'
            columns: ['container_id']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_alerts_derivation_generation_id_fkey'
            columns: ['derivation_generation_id']
            isOneToOne: false
            referencedRelation: 'tracking_derivation_generations'
            referencedColumns: ['id']
          },
        ]
      }
      tracking_derivation_generations: {
        Row: {
          activated_at: string | null
          container_id: string
          created_at: string
          id: string
          metadata_json: Json
          source_kind: string
          source_run_id: string | null
          superseded_at: string | null
        }
        Insert: {
          activated_at?: string | null
          container_id: string
          created_at?: string
          id?: string
          metadata_json?: Json
          source_kind: string
          source_run_id?: string | null
          superseded_at?: string | null
        }
        Update: {
          activated_at?: string | null
          container_id?: string
          created_at?: string
          id?: string
          metadata_json?: Json
          source_kind?: string
          source_run_id?: string | null
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_derivation_generations_container_id_fkey'
            columns: ['container_id']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_derivation_generations_source_run_id_fkey'
            columns: ['source_run_id']
            isOneToOne: false
            referencedRelation: 'tracking_replay_runs'
            referencedColumns: ['id']
          },
        ]
      }
      tracking_generation_pointers: {
        Row: {
          active_generation_id: string
          container_id: string
          previous_generation_id: string | null
          updated_at: string
          updated_by_run_id: string | null
        }
        Insert: {
          active_generation_id: string
          container_id: string
          previous_generation_id?: string | null
          updated_at?: string
          updated_by_run_id?: string | null
        }
        Update: {
          active_generation_id?: string
          container_id?: string
          previous_generation_id?: string | null
          updated_at?: string
          updated_by_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_generation_pointers_active_generation_id_fkey'
            columns: ['active_generation_id']
            isOneToOne: false
            referencedRelation: 'tracking_derivation_generations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_generation_pointers_container_id_fkey'
            columns: ['container_id']
            isOneToOne: true
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_generation_pointers_previous_generation_id_fkey'
            columns: ['previous_generation_id']
            isOneToOne: false
            referencedRelation: 'tracking_derivation_generations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_generation_pointers_updated_by_run_id_fkey'
            columns: ['updated_by_run_id']
            isOneToOne: false
            referencedRelation: 'tracking_replay_runs'
            referencedColumns: ['id']
          },
        ]
      }
      tracking_replay_locks: {
        Row: {
          acquired_at: string
          container_id: string
          expires_at: string
          heartbeat_at: string
          mode: string
          owner_token: string
          run_id: string
          run_target_id: string
        }
        Insert: {
          acquired_at?: string
          container_id: string
          expires_at: string
          heartbeat_at?: string
          mode: string
          owner_token: string
          run_id: string
          run_target_id: string
        }
        Update: {
          acquired_at?: string
          container_id?: string
          expires_at?: string
          heartbeat_at?: string
          mode?: string
          owner_token?: string
          run_id?: string
          run_target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_replay_locks_container_id_fkey'
            columns: ['container_id']
            isOneToOne: true
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_replay_locks_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'tracking_replay_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_replay_locks_run_target_id_fkey'
            columns: ['run_target_id']
            isOneToOne: false
            referencedRelation: 'tracking_replay_run_targets'
            referencedColumns: ['id']
          },
        ]
      }
      tracking_replay_run_targets: {
        Row: {
          container_id: string
          container_number: string
          created_at: string
          created_generation_id: string | null
          diff_summary_json: Json
          error_message: string | null
          id: string
          lock_expires_at: string | null
          lock_heartbeat_at: string | null
          provider: string | null
          run_id: string
          snapshot_count: number
          status: string
          updated_at: string
        }
        Insert: {
          container_id: string
          container_number: string
          created_at?: string
          created_generation_id?: string | null
          diff_summary_json?: Json
          error_message?: string | null
          id?: string
          lock_expires_at?: string | null
          lock_heartbeat_at?: string | null
          provider?: string | null
          run_id: string
          snapshot_count?: number
          status: string
          updated_at?: string
        }
        Update: {
          container_id?: string
          container_number?: string
          created_at?: string
          created_generation_id?: string | null
          diff_summary_json?: Json
          error_message?: string | null
          id?: string
          lock_expires_at?: string | null
          lock_heartbeat_at?: string | null
          provider?: string | null
          run_id?: string
          snapshot_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_replay_run_targets_container_id_fkey'
            columns: ['container_id']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_replay_run_targets_created_generation_id_fkey'
            columns: ['created_generation_id']
            isOneToOne: false
            referencedRelation: 'tracking_derivation_generations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_replay_run_targets_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'tracking_replay_runs'
            referencedColumns: ['id']
          },
        ]
      }
      tracking_replay_runs: {
        Row: {
          code_version: string | null
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          mode: string
          reason: string | null
          requested_by: string
          started_at: string | null
          status: string
          summary_json: Json
        }
        Insert: {
          code_version?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode: string
          reason?: string | null
          requested_by: string
          started_at?: string | null
          status: string
          summary_json?: Json
        }
        Update: {
          code_version?: string | null
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          reason?: string | null
          requested_by?: string
          started_at?: string | null
          status?: string
          summary_json?: Json
        }
        Relationships: []
      }
      tracking_validation_issue_transitions: {
        Row: {
          affected_scope: string
          container_id: string
          created_at: string
          detector_id: string
          detector_version: string
          evidence_summary: string
          id: string
          issue_code: string
          lifecycle_key: string
          occurred_at: string
          process_id: string
          provider: string
          severity: string
          snapshot_id: string
          state_fingerprint: string
          transition_type: string
        }
        Insert: {
          affected_scope: string
          container_id: string
          created_at?: string
          detector_id: string
          detector_version: string
          evidence_summary: string
          id?: string
          issue_code: string
          lifecycle_key: string
          occurred_at: string
          process_id: string
          provider: string
          severity: string
          snapshot_id: string
          state_fingerprint: string
          transition_type: string
        }
        Update: {
          affected_scope?: string
          container_id?: string
          created_at?: string
          detector_id?: string
          detector_version?: string
          evidence_summary?: string
          id?: string
          issue_code?: string
          lifecycle_key?: string
          occurred_at?: string
          process_id?: string
          provider?: string
          severity?: string
          snapshot_id?: string
          state_fingerprint?: string
          transition_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tracking_validation_issue_transitions_container_id_fkey'
            columns: ['container_id']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_validation_issue_transitions_process_id_fkey'
            columns: ['process_id']
            isOneToOne: false
            referencedRelation: 'processes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tracking_validation_issue_transitions_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'container_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      active_container_observations: {
        Row: {
          carrier_label: string | null
          confidence: string
          container_id: string
          container_number: string
          created_at: string
          created_from_snapshot_id: string | null
          derivation_generation_id: string
          event_date: string | null
          event_time_local: string | null
          event_time_source: string | null
          event_time_zone: string | null
          event_time: string | null
          event_time_instant: string | null
          event_time_type: string
          fingerprint: string
          id: string
          is_empty: boolean | null
          location_code: string | null
          location_display: string | null
          provider: string
          raw_event_time: string | null
          retroactive: boolean
          temporal_kind: string | null
          type: string
          vessel_name: string | null
          voyage: string | null
        }
        Relationships: []
      }
      active_tracking_alerts: {
        Row: {
          acked_at: string | null
          acked_by: string | null
          acked_source: string | null
          alert_fingerprint: string | null
          category: string
          container_id: string
          created_at: string
          detected_at: string
          derivation_generation_id: string
          id: string
          lifecycle_state: string
          message_key: string
          message_params: Json
          provider: string | null
          resolved_at: string | null
          resolved_reason: string | null
          retroactive: boolean
          severity: string
          source_observation_fingerprints: Json
          triggered_at: string
          type: string
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_tracking_replay_lock: {
        Args: {
          p_container_id: string
          p_mode: string
          p_owner_token: string
          p_run_id: string
          p_run_target_id: string
          p_ttl_seconds?: number
        }
        Returns: {
          acquired: boolean
          expires_at: string
          lock_owner_run_target_id: string
        }[]
      }
      enqueue_container_sync_batch: {
        Args: {
          p_due_window?: string
          p_limit_per_provider?: number
          p_recent_window?: string
        }
        Returns: {
          deduped_open_count: number
          enqueued_new_count: number
          provider: string
          selected_count: number
        }[]
      }
      enqueue_sync_request: {
        Args: {
          p_priority?: number
          p_provider: string
          p_ref_type?: string
          p_ref_value?: string
          p_tenant_id: string
        }
        Returns: {
          id: string
          is_new: boolean
          status: Database['public']['Enums']['sync_request_status']
        }[]
      }
      has_active_tracking_replay_lock_for_container_number: {
        Args: {
          p_container_number: string
        }
        Returns: boolean
      }
      heartbeat_tracking_replay_lock: {
        Args: {
          p_container_id: string
          p_owner_token: string
          p_run_target_id: string
          p_ttl_seconds?: number
        }
        Returns: boolean
      }
      lease_sync_requests: {
        Args: {
          p_agent_id: string
          p_include_owned_active_leases?: boolean
          p_lease_minutes?: number
          p_limit?: number
          p_processable_providers?: string[]
          p_tenant_id: string
        }
        Returns: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          leased_by: string | null
          leased_until: string | null
          priority: number
          provider: string
          ref_type: string
          ref_value: string
          status: Database['public']['Enums']['sync_request_status']
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'sync_requests'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      release_tracking_replay_lock: {
        Args: {
          p_container_id: string
          p_owner_token: string
          p_run_target_id: string
        }
        Returns: boolean
      }
      resolve_or_create_active_tracking_generation: {
        Args: {
          p_container_id: string
        }
        Returns: string
      }
      prune_agent_log_events: { Args: never; Returns: number }
      prune_sync_requests: { Args: never; Returns: number }
      prune_tracking_agent_activity_events: { Args: never; Returns: number }
    }
    Enums: {
      sync_request_status: 'PENDING' | 'LEASED' | 'DONE' | 'FAILED'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      sync_request_status: ['PENDING', 'LEASED', 'DONE', 'FAILED'],
    },
  },
} as const
