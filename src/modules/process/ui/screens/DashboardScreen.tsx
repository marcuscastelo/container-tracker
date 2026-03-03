import { useNavigate } from '@solidjs/router'
import type { JSX } from 'solid-js'
import { createResource, createSignal, Show } from 'solid-js'
import type { CreateProcessDialogFormData } from '~/modules/process/ui/CreateProcessDialog'
import { CreateProcessDialog } from '~/modules/process/ui/CreateProcessDialog'
import { DashboardMetricsGrid } from '~/modules/process/ui/components/DashboardMetricsGrid'
import { DashboardProcessTable } from '~/modules/process/ui/components/DashboardProcessTable'
import {
  createProcessRequest,
  fetchDashboardGlobalAlertsSummary,
  fetchDashboardProcessSummaries,
  toCreateProcessInput,
} from '~/modules/process/ui/validation/processApi.validation'
import {
  type ExistingProcessConflict,
  parseExistingProcessConflictError,
} from '~/modules/process/ui/validation/processConflict.validation'
import { AppHeader } from '~/shared/ui/AppHeader'
import { ExistingProcessError } from '~/shared/ui/ExistingProcessError'

export function Dashboard(props: { readonly searchSlot?: JSX.Element }): JSX.Element {
  const navigate = useNavigate()
  const [processes, { refetch: refetchProcesses }] = createResource(fetchDashboardProcessSummaries)
  const [globalAlerts, { refetch: refetchGlobalAlerts }] = createResource(
    fetchDashboardGlobalAlertsSummary,
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = createSignal(false)
  const [createError, setCreateError] = createSignal<string | ExistingProcessConflict | null>(null)

  const handleCreateProcess = () => {
    setCreateError(null)
    setIsCreateDialogOpen(true)
  }

  const handleProcessSubmit = async (data: CreateProcessDialogFormData) => {
    try {
      setCreateError(null)

      const processId = await createProcessRequest(toCreateProcessInput(data))

      // Refetch dashboard lists
      await Promise.all([refetchProcesses(), refetchGlobalAlerts()])

      // Close dialog
      setIsCreateDialogOpen(false)

      // Navigate to the new process
      navigate(`/shipments/${processId}`)
    } catch (err) {
      console.error('Failed to create process:', err)
      const conflict = parseExistingProcessConflictError(err)
      if (conflict) {
        setCreateError(conflict)
        return
      }
      setCreateError(err instanceof Error ? err.message : 'Failed to create process')
    }
  }

  const createErrorMessage = () => {
    const value = createError()
    if (typeof value === 'string') return value
    return value?.message ?? ''
  }

  const createErrorExisting = () => {
    const value = createError()
    if (typeof value === 'string') return undefined
    return value ?? undefined
  }

  return (
    <div class="min-h-screen bg-slate-50/80">
      <AppHeader onCreateProcess={handleCreateProcess} />
      <CreateProcessDialog
        open={isCreateDialogOpen()}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleProcessSubmit}
      />

      <main class="mx-auto max-w-7xl px-4 py-4 lg:px-6">
        <Show when={props.searchSlot}>
          <div class="mb-4 flex justify-center">{props.searchSlot}</div>
        </Show>

        {/* Error message */}
        <Show when={createError()}>
          <ExistingProcessError
            message={createErrorMessage()}
            existing={createErrorExisting()}
            onAcknowledge={() => setCreateError(null)}
          />
        </Show>

        <DashboardMetricsGrid
          summary={globalAlerts() ?? null}
          loading={globalAlerts.loading}
          hasError={Boolean(globalAlerts.error)}
        />
        <DashboardProcessTable
          processes={processes() ?? []}
          loading={processes.loading}
          hasError={Boolean(processes.error)}
          onCreateProcess={handleCreateProcess}
        />
      </main>
    </div>
  )
}
