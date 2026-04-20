import type {
  PredictionHistorySource,
  PredictionHistoryVersionSource,
} from '~/modules/process/ui/viewmodels/prediction-history.vm'
import type { TemporalValueDto } from '~/shared/time/dto'

type SerializePredictionHistorySeriesToTextCommand = {
  readonly source: PredictionHistorySource
  readonly activityLabel: string
}

type TemporalTimeParts = {
  readonly second: number | null
  readonly millisecond: number | null
}

function toNullableText(value: string | null): string {
  return value === null ? 'null' : value
}

function parseTemporalTimeParts(eventTime: TemporalValueDto | null): TemporalTimeParts {
  if (eventTime === null || eventTime.kind === 'date') {
    return {
      second: null,
      millisecond: null,
    }
  }

  const timeMatch = eventTime.value.match(/T\d{2}:\d{2}:(\d{2})(?:\.(\d+))?/)
  if (timeMatch === null) {
    return {
      second: null,
      millisecond: null,
    }
  }

  const secondText = timeMatch[1]
  const second = Number.parseInt(secondText ?? '', 10)
  if (!Number.isInteger(second) || second < 0 || second > 59) {
    return {
      second: null,
      millisecond: null,
    }
  }

  const fractionText = timeMatch[2]
  if (fractionText === undefined) {
    return {
      second,
      millisecond: 0,
    }
  }

  const millisecondText = fractionText.slice(0, 3).padEnd(3, '0')
  const millisecond = Number.parseInt(millisecondText, 10)

  if (!Number.isInteger(millisecond) || millisecond < 0 || millisecond > 999) {
    return {
      second,
      millisecond: null,
    }
  }

  return {
    second,
    millisecond,
  }
}

function toTemporalTimezone(eventTime: TemporalValueDto): string | null {
  if (eventTime.kind === 'instant') {
    return null
  }

  if (eventTime.kind === 'date') {
    return eventTime.timezone ?? null
  }

  return eventTime.timezone
}

function toSerializedEventTime(eventTime: TemporalValueDto | null): string {
  if (eventTime === null) {
    return 'null'
  }

  return JSON.stringify({
    kind: eventTime.kind,
    value: eventTime.value,
    timezone: toTemporalTimezone(eventTime),
  })
}

function pushHeaderLines(lines: string[], source: PredictionHistorySource): void {
  lines.push('Header')
  lines.push(`- tone: ${source.header.tone}`)
  lines.push(`- summaryKind: ${source.header.summaryKind}`)
  lines.push(`- currentVersionId: ${source.header.currentVersionId}`)
  lines.push(`- previousVersionId: ${toNullableText(source.header.previousVersionId)}`)
  lines.push(`- originalVersionId: ${toNullableText(source.header.originalVersionId)}`)
  lines.push(`- reasonKind: ${toNullableText(source.header.reasonKind)}`)
}

function pushVersionLines(
  lines: string[],
  version: PredictionHistoryVersionSource,
  versionIndex: number,
): void {
  const eventTime = version.eventTime
  const timezone = eventTime === null ? null : toTemporalTimezone(eventTime)
  const timeParts = parseTemporalTimeParts(eventTime)

  lines.push('')
  lines.push(`[${String(versionIndex + 1)}]`)
  lines.push(`- id: ${version.id}`)
  lines.push(`- isCurrent: ${version.isCurrent ? 'true' : 'false'}`)
  lines.push(`- type: ${version.type}`)
  lines.push(`- eventTime: ${toSerializedEventTime(eventTime)}`)
  lines.push(`- eventTime.kind: ${eventTime === null ? 'null' : eventTime.kind}`)
  lines.push(`- eventTime.value: ${eventTime === null ? 'null' : eventTime.value}`)
  lines.push(`- eventTime.timezone: ${toNullableText(timezone)}`)
  lines.push(`- eventTime.second: ${timeParts.second === null ? 'null' : String(timeParts.second)}`)
  lines.push(
    `- eventTime.millisecond: ${
      timeParts.millisecond === null ? 'null' : String(timeParts.millisecond)
    }`,
  )
  lines.push(`- eventTimeType: ${version.eventTimeType}`)
  lines.push(`- vesselName: ${toNullableText(version.vesselName)}`)
  lines.push(`- voyage: ${toNullableText(version.voyage)}`)
  lines.push(`- versionState: ${version.versionState}`)
  lines.push(`- explanatoryTextKind: ${toNullableText(version.explanatoryTextKind)}`)
  lines.push(
    `- transitionKindFromPreviousVersion: ${toNullableText(version.transitionKindFromPreviousVersion)}`,
  )
  lines.push(`- observedAtCount: ${String(version.observedAtCount)}`)
  lines.push('- observedAtList:')
  for (const observedAt of version.observedAtList) {
    lines.push(`  - ${observedAt}`)
  }
  lines.push(`- firstObservedAt: ${version.firstObservedAt}`)
  lines.push(`- lastObservedAt: ${version.lastObservedAt}`)
}

export function serializePredictionHistorySeriesToText(
  command: SerializePredictionHistorySeriesToTextCommand,
): string {
  const lines: string[] = []

  lines.push('Prediction History Series')
  lines.push(`Activity: ${command.activityLabel}`)
  lines.push('')

  pushHeaderLines(lines, command.source)

  lines.push('')
  lines.push(`Versions (${String(command.source.versions.length)})`)

  command.source.versions.forEach((version, index) => {
    pushVersionLines(lines, version, index)
  })

  return lines.join('\n')
}
