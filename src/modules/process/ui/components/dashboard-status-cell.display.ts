import { createMemo } from 'solid-js'
import { toDashboardStatusCellDisplay } from '~/modules/process/ui/components/dashboard-status-cell.presenter'

type DashboardStatusCellDisplayCommand = Parameters<typeof toDashboardStatusCellDisplay>[0]

type DashboardStatusCellDisplayBuilder = (
  command: DashboardStatusCellDisplayCommand,
) => ReturnType<typeof toDashboardStatusCellDisplay>

export function createDashboardStatusCellDisplayMemo(config: {
  readonly getCommand: () => DashboardStatusCellDisplayCommand
  readonly buildDisplay?: DashboardStatusCellDisplayBuilder
}) {
  const buildDisplay = config.buildDisplay ?? toDashboardStatusCellDisplay
  const display = createMemo(() => {
    const displayCommand = config.getCommand()
    return buildDisplay(displayCommand)
  })

  return display
}
