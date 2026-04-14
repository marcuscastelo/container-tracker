import { z } from 'zod/v4'

export const AgentRealtimeStateSchema = z.enum([
  'SUBSCRIBED',
  'CHANNEL_ERROR',
  'CONNECTING',
  'DISCONNECTED',
  'UNKNOWN',
])

export const AgentProcessingStateSchema = z.enum([
  'idle',
  'leasing',
  'processing',
  'backing_off',
  'unknown',
])

export const AgentLeaseHealthSchema = z.enum(['healthy', 'stale', 'conflict', 'unknown'])

export const AgentBootStatusSchema = z.enum(['starting', 'healthy', 'degraded', 'unknown'])

export const AgentUpdateStateSchema = z.enum([
  'idle',
  'checking',
  'downloading',
  'ready',
  'draining',
  'applying',
  'rollback',
  'blocked',
  'error',
  'unknown',
])

export const AgentActivitySeveritySchema = z.enum(['info', 'warning', 'danger', 'success'])

export type AgentRealtimeState = z.infer<typeof AgentRealtimeStateSchema>
export type AgentProcessingState = z.infer<typeof AgentProcessingStateSchema>
export type AgentLeaseHealth = z.infer<typeof AgentLeaseHealthSchema>
export type AgentBootStatus = z.infer<typeof AgentBootStatusSchema>
export type AgentUpdateState = z.infer<typeof AgentUpdateStateSchema>
export type AgentActivitySeverity = z.infer<typeof AgentActivitySeveritySchema>
