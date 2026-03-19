import type {
  OperationalSnapshotReport,
  ReportProcessEntry,
} from '~/capabilities/export-import/application/export-import.models'

export type TrelloMarkdownFile = {
  readonly name: string
  readonly content: string
}

function toIsoDatePart(isoString: string | null): string {
  if (!isoString) return ''
  return isoString.slice(0, 10)
}

function toSingleLine(value: string | null): string {
  if (value === null) return ''
  return value.replaceAll(/\s+/g, ' ').trim()
}

function toFieldLine(label: string, value: string): string {
  return value.length > 0 ? `${label}: ${value}` : `${label}:`
}

function toSafeFilenameSegment(value: string): string {
  const normalized = value
    .replaceAll(/[^A-Za-z0-9._-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return normalized.length > 0 ? normalized : 'process'
}

function resolveProcessShortRef(processEntry: ReportProcessEntry): string {
  const reference = toSingleLine(processEntry.reference)
  if (reference.length > 0) return reference
  return `PROCESS-${processEntry.id}`
}

function resolveProcessTitle(processEntry: ReportProcessEntry): string {
  const segments = [`REF. CASTRO: ${resolveProcessShortRef(processEntry)}`]
  const importerName = toSingleLine(processEntry.importerName)
  const exporterName = toSingleLine(processEntry.exporterName)
  const product = toSingleLine(processEntry.product)

  if (importerName.length > 0) {
    segments.push(`IMP: ${importerName}`)
  }

  if (exporterName.length > 0) {
    segments.push(`EXP: ${exporterName}`)
  }

  if (product.length > 0) {
    segments.push(product)
  }

  return segments.join(' - ')
}

function resolveVesselName(processEntry: ReportProcessEntry): string {
  for (const container of processEntry.containers) {
    const vesselName = toSingleLine(container.vesselName)
    if (vesselName.length > 0) return vesselName
  }

  return ''
}

function resolveContainersLine(processEntry: ReportProcessEntry): string {
  return processEntry.containers.map((container) => container.containerNumber).join(' / ')
}

function resolveLatestEventLabel(processEntry: ReportProcessEntry): string {
  let latestEventLabel = ''
  let latestEventAt = Number.NEGATIVE_INFINITY
  let latestTrackingUpdateAt = Number.NEGATIVE_INFINITY

  for (const container of processEntry.containers) {
    if (container.latestEvent === null) continue
    const timestamp = Date.parse(container.latestEvent)
    const trackingUpdateAt = container.latestTrackingUpdate
      ? Date.parse(container.latestTrackingUpdate)
      : Number.NEGATIVE_INFINITY
    if (Number.isNaN(timestamp)) continue
    if (timestamp < latestEventAt) continue
    if (timestamp === latestEventAt && trackingUpdateAt <= latestTrackingUpdateAt) continue

    const nextLabel = toSingleLine(container.latestEventLabel)
    latestEventAt = timestamp
    latestTrackingUpdateAt = trackingUpdateAt
    latestEventLabel = nextLabel.length > 0 ? nextLabel : toSingleLine(container.latestEvent)
  }

  return latestEventLabel
}

function resolveAlerts(processEntry: ReportProcessEntry): string {
  const alertTypes: string[] = []
  const seen = new Set<string>()

  for (const container of processEntry.containers) {
    for (const alert of container.alerts) {
      if (seen.has(alert.type)) continue
      seen.add(alert.type)
      alertTypes.push(alert.type)
    }
  }

  return JSON.stringify(alertTypes)
}

export function serializeTrelloProcessMarkdown(command: {
  readonly report: OperationalSnapshotReport
  readonly processEntry: ReportProcessEntry
}): string {
  const { processEntry, report } = command
  const lines = [
    `# ${resolveProcessShortRef(processEntry)}`,
    `## ${resolveProcessTitle(processEntry)}`,
    '',
    '```yml',
    toFieldLine('NAVIO', resolveVesselName(processEntry)),
    toFieldLine('PREVISÃO', toIsoDatePart(processEntry.eta)),
    'CHEGADA:',
    toFieldLine('BL', toSingleLine(processEntry.billOfLading)),
    toFieldLine('CTNR', resolveContainersLine(processEntry)),
    toFieldLine('ORIGEM', toSingleLine(processEntry.origin)),
    'PROFORMA:',
    'INVOICE COMERCIAL:',
    toFieldLine('DEPOSITARIO', toSingleLine(processEntry.destination)),
    toFieldLine('REDESTINACAO', toSingleLine(processEntry.redestinationNumber)),
    '```',
    '',
    `### Snapshot ${toIsoDatePart(report.exportedAt)}`,
    '',
    toFieldLine('process_status', processEntry.processStatus),
    toFieldLine('last_event', resolveLatestEventLabel(processEntry)),
    toFieldLine('last_sync_at', processEntry.lastSyncAt ?? ''),
    toFieldLine('alerts', resolveAlerts(processEntry)),
    toFieldLine('exported_at', report.exportedAt),
    '',
  ]

  return lines.join('\n')
}

export function buildTrelloMarkdownFiles(
  report: OperationalSnapshotReport,
): readonly TrelloMarkdownFile[] {
  return report.processes.map((processEntry) => {
    const shortRef = resolveProcessShortRef(processEntry)
    return {
      name: `snapshot-${toSafeFilenameSegment(shortRef)}.md`,
      content: serializeTrelloProcessMarkdown({
        report,
        processEntry,
      }),
    }
  })
}
