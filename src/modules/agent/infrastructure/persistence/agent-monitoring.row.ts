import type { Database } from '~/shared/supabase/database.types'

export type TrackingAgentRow = Database['public']['Tables']['tracking_agents']['Row']
export type TrackingAgentUpdate = Database['public']['Tables']['tracking_agents']['Update']

export type TrackingAgentActivityEventRow =
  Database['public']['Tables']['tracking_agent_activity_events']['Row']
export type TrackingAgentActivityEventInsert =
  Database['public']['Tables']['tracking_agent_activity_events']['Insert']
