export type AgentLogsChannel = 'stdout' | 'stderr' | 'both'

export type AgentLogsConnectionState = 'connecting' | 'live' | 'disconnected' | 'reconnecting'

export type AgentLogLineVM = {
  readonly id: string
  readonly agentId: string
  readonly sequence: number
  readonly channel: 'stdout' | 'stderr'
  readonly channelLabel: 'OUT' | 'ERR'
  readonly timestampIso: string
  readonly timestampDisplay: string
  readonly message: string
  readonly truncated: boolean
}
