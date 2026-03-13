import { createMemo } from 'solid-js'
import { toDashboardStatusCellDisplay } from '~/modules/process/ui/components/dashboard-status-cell.presenter'

type DashboardStatusCellDisplayCommand = Parameters<typeof toDashboardStatusCellDisplay>[0]

type DashboardStatusCellDisplayBuilder = (
  command: DashboardStatusCellDisplayCommand,
) => ReturnType<typeof toDashboardStatusCellDisplay>

export function createDashboardStatusCellDisplayMemo(command: {
  readonly getCommand: () => DashboardStatusCellDisplayCommand
  readonly buildDisplay?: DashboardStatusCellDisplayBuilder
}) {
  const buildDisplay = command.buildDisplay ?? toDashboardStatusCellDisplay
  const display = createMemo(() => {
    const displayCommand = command.getCommand()
    return buildDisplay(displayCommand)
  })

  return display
}
