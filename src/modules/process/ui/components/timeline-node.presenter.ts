export type TimelineNodeAttentionDisplay = {
  readonly rowClass: string
  readonly dotAccentClass: string
  readonly showConflictBadge: boolean
}

const NEUTRAL_ATTENTION_DISPLAY: TimelineNodeAttentionDisplay = {
  rowClass: '',
  dotAccentClass: '',
  showConflictBadge: false,
}

export function toTimelineNodeAttentionDisplay(input: {
  readonly hasSeriesConflict: boolean
}): TimelineNodeAttentionDisplay {
  if (input.hasSeriesConflict) {
    return {
      rowClass: 'ring-1 ring-inset ring-tone-warning-border/70',
      dotAccentClass: 'ring-2 ring-tone-warning-border/45 ring-offset-1 ring-offset-surface',
      showConflictBadge: true,
    }
  }

  return NEUTRAL_ATTENTION_DISPLAY
}
