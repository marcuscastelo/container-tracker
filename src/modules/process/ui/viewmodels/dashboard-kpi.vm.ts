import type { LucideIcon } from 'lucide-solid'

export type DashboardKpiVM = {
  readonly label: string
  readonly value: string
  readonly detail?: string
  readonly href?: string
  readonly tone?: 'default' | 'warning'
  readonly icon: LucideIcon
}
