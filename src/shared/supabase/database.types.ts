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
      alerts: {
        Row: {
          acknowledged_at: string | null
          category: string
          code: string
          container_id: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          process_id: string | null
          related_event_ids: Json | null
          resolved_at: string | null
          severity: string
          state: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          category: string
          code: string
          container_id?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          process_id?: string | null
          related_event_ids?: Json | null
          resolved_at?: string | null
          severity: string
          state: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          category?: string
          code?: string
          container_id?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          process_id?: string | null
          related_event_ids?: Json | null
          resolved_at?: string | null
          severity?: string
          state?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      'container-events': {
        Row: {
          actuality: string
          container_number: string
          created_at: string
          event_time: string
          id: string
          source: Json
          type: string
          updated_at: string
        }
        Insert: {
          actuality: string
          container_number: string
          created_at?: string
          event_time: string
          id: string
          source: Json
          type: string
          updated_at?: string
        }
        Update: {
          actuality?: string
          container_number?: string
          created_at?: string
          event_time?: string
          id?: string
          source?: Json
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'container-events_container_number_fkey'
            columns: ['container_number']
            isOneToOne: false
            referencedRelation: 'containers'
            referencedColumns: ['container_number']
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
          operation_type: string
          origin: Json | null
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
          operation_type: string
          origin?: Json | null
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
          operation_type?: string
          origin?: Json | null
          reference?: string | null
          reference_importer?: string | null
          source?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
