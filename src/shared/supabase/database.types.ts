/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      container_observations: {
        Row: {
          confidence: string
          container_id: string
          container_number: string
          created_at: string
          created_from_snapshot_id: string | null
          event_time: string | null
          event_time_type: string
          fingerprint: string
          id: string
          is_empty: boolean | null
          location_code: string | null
          location_display: string | null
          provider: string
          retroactive: boolean
          type: string
          vessel_name: string | null
          voyage: string | null
        }
        Insert: {
          confidence: string
          container_id: string
          container_number: string
          created_at?: string
          created_from_snapshot_id?: string | null
          event_time?: string | null
          event_time_type: string
          fingerprint: string
          id?: string
          is_empty?: boolean | null
          location_code?: string | null
          location_display?: string | null
          provider: string
          retroactive?: boolean
          type: string
          vessel_name?: string | null
          voyage?: string | null
        }
        Update: {
          confidence?: string
          container_id?: string
          container_number?: string
          created_at?: string
          created_from_snapshot_id?: string | null
          event_time?: string | null
          event_time_type?: string
          fingerprint?: string
          id?: string
          is_empty?: boolean | null
          location_code?: string | null
          location_display?: string | null
          provider?: string
          retroactive?: boolean
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
      tracking_alerts: {
        Row: {
          acked_at: string | null
          alert_fingerprint: string | null
          category: string
          container_id: string
          created_at: string
          detected_at: string
          dismissed_at: string | null
          id: string
          message: string
          provider: string | null
          retroactive: boolean
          severity: string
          source_observation_fingerprints: Json
          triggered_at: string
          type: string
        }
        Insert: {
          acked_at?: string | null
          alert_fingerprint?: string | null
          category: string
          container_id?: string
          created_at?: string
          detected_at: string
          dismissed_at?: string | null
          id?: string
          message: string
          provider?: string | null
          retroactive: boolean
          severity: string
          source_observation_fingerprints: Json
          triggered_at: string
          type: string
        }
        Update: {
          acked_at?: string | null
          alert_fingerprint?: string | null
          category?: string
          container_id?: string
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string
          provider?: string | null
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      lease_sync_requests: {
        Args: {
          p_agent_id: string
          p_lease_minutes?: number
          p_limit?: number
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
