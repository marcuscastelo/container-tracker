import type {
  AlertIncidentCategoryVM,
  AlertIncidentVM,
} from '~/modules/process/ui/viewmodels/alert-incident.vm'

export type ShipmentAlertIncidentFilter = 'all' | AlertIncidentCategoryVM

function compareSeverity(
  left: AlertIncidentVM['severity'],
  right: AlertIncidentVM['severity'],
): number {
  const rank = {
    info: 0,
    warning: 1,
    danger: 2,
  } as const

  return rank[left] - rank[right]
}

function compareIncidents(left: AlertIncidentVM, right: AlertIncidentVM): number {
  const severityCompare = compareSeverity(right.severity, left.severity)
  if (severityCompare !== 0) return severityCompare

  const triggeredAtCompare = right.triggeredAtIso.localeCompare(left.triggeredAtIso)
  if (triggeredAtCompare !== 0) return triggeredAtCompare

  return left.incidentKey.localeCompare(right.incidentKey)
}

export function toSortedAlertIncidents(
  incidents: readonly AlertIncidentVM[],
): readonly AlertIncidentVM[] {
  return [...incidents].sort(compareIncidents)
}

export function filterAlertIncidents(
  incidents: readonly AlertIncidentVM[],
  filter: ShipmentAlertIncidentFilter,
): readonly AlertIncidentVM[] {
  if (filter === 'all') return incidents
  return incidents.filter((incident) => incident.category === filter)
}

export function countAffectedContainers(incidents: readonly AlertIncidentVM[]): number {
  const containerIds = new Set<string>()

  for (const incident of incidents) {
    for (const member of incident.members) {
      containerIds.add(member.containerId)
    }
  }

  return containerIds.size
}
