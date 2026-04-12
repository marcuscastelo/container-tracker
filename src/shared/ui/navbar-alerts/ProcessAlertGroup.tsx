import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { AlertItem } from '~/shared/ui/navbar-alerts/AlertItem'
import type { NavbarProcessAlertGroupVM } from '~/shared/ui/navbar-alerts/navbar-alerts.vm'

type ProcessAlertGroupProps = {
  readonly process: NavbarProcessAlertGroupVM
  readonly onOpenProcess: (processId: string) => void
  readonly onOpenContainer: (processId: string, containerNumber: string) => void
}

export function ProcessAlertGroup(props: ProcessAlertGroupProps): JSX.Element {
  return (
    <section class="space-y-2.5">
      <For each={props.process.incidents}>
        {(incident) => (
          <AlertItem
            processId={props.process.processId}
            processReference={props.process.processReference}
            processCarrier={props.process.carrier}
            processRouteSummary={props.process.routeSummary}
            incident={incident}
            onOpenProcess={props.onOpenProcess}
            onOpenContainer={props.onOpenContainer}
          />
        )}
      </For>
    </section>
  )
}
