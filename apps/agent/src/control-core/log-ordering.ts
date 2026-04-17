import type { AgentControlLogsResponse } from '@agent/control-core/contracts'

const ISO_TIMESTAMP_PATTERN =
  /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/u

type AgentControlLogLine = AgentControlLogsResponse['lines'][number]

function extractTimestampMs(message: string): number | null {
  const matchedTimestamp = message.match(ISO_TIMESTAMP_PATTERN)?.[1]
  if (!matchedTimestamp) {
    return null
  }

  const parsed = Date.parse(matchedTimestamp)
  return Number.isNaN(parsed) ? null : parsed
}

export function sortMergedLogLinesByTimestamp(
  lines: readonly AgentControlLogLine[],
): AgentControlLogLine[] {
  return lines
    .map((line, index) => ({
      line,
      index,
      timestampMs: extractTimestampMs(line.message),
    }))
    .sort((left, right) => {
      if (
        left.timestampMs !== null &&
        right.timestampMs !== null &&
        left.timestampMs !== right.timestampMs
      ) {
        return left.timestampMs - right.timestampMs
      }

      return left.index - right.index
    })
    .map((entry) => entry.line)
}
