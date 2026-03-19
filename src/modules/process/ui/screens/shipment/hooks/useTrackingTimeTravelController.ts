import type { Accessor } from 'solid-js'
import { createEffect, createMemo, createResource, createSignal } from 'solid-js'
import { toReadableErrorMessage } from '~/modules/process/ui/screens/shipment/lib/shipmentError.presenter'
import {
  findTrackingTimeTravelSync,
  selectAdjacentTrackingTimeTravelSnapshotId,
} from '~/modules/process/ui/screens/shipment/lib/tracking-time-travel.selection.service'
import {
  toTrackingReplayDebugVm,
  toTrackingTimeTravelVm,
} from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.ui-mapper'
import type {
  TrackingReplayDebugVM,
  TrackingTimeTravelSyncVM,
  TrackingTimeTravelVM,
} from '~/modules/process/ui/screens/shipment/types/tracking-time-travel.vm'
import { fetchTrackingReplayDebug } from '~/modules/process/ui/screens/shipment/usecases/fetchTrackingReplayDebug.usecase'
import { fetchTrackingTimeTravel } from '~/modules/process/ui/screens/shipment/usecases/fetchTrackingTimeTravel.usecase'
import type { ContainerDetailVM } from '~/modules/process/ui/viewmodels/shipment.vm'
import type { TrackingReplayDebugResponseDto } from '~/modules/tracking/interface/http/tracking.schemas'
import { useTranslation } from '~/shared/localization/i18n'

type UseTrackingTimeTravelControllerCommand = {
  readonly selectedContainer: Accessor<ContainerDetailVM | null>
}

export type TrackingTimeTravelControllerResult = {
  readonly isActive: Accessor<boolean>
  readonly isLoading: Accessor<boolean>
  readonly errorMessage: Accessor<string | null>
  readonly value: Accessor<TrackingTimeTravelVM | null>
  readonly selectedSync: Accessor<TrackingTimeTravelSyncVM | null>
  readonly isDebugOpen: Accessor<boolean>
  readonly isDebugLoading: Accessor<boolean>
  readonly debugErrorMessage: Accessor<string | null>
  readonly debugValue: Accessor<TrackingReplayDebugVM | null>
  readonly debugPayload: Accessor<TrackingReplayDebugResponseDto | null>
  readonly open: () => void
  readonly close: () => void
  readonly toggleDebug: () => void
  readonly selectSnapshot: (snapshotId: string) => void
  readonly selectPrevious: () => void
  readonly selectNext: () => void
}

export function useTrackingTimeTravelController(
  command: UseTrackingTimeTravelControllerCommand,
): TrackingTimeTravelControllerResult {
  const { locale } = useTranslation()
  const [isActive, setIsActive] = createSignal(false)
  const [selectedSnapshotId, setSelectedSnapshotId] = createSignal('')
  const [isDebugOpen, setIsDebugOpen] = createSignal(false)
  const [activeContainerId, setActiveContainerId] = createSignal<string | null>(null)

  const [timeTravelResponse] = createResource(
    () => {
      const container = command.selectedContainer()
      if (!isActive() || !container) return null
      return container.id
    },
    async (containerId) => fetchTrackingTimeTravel(containerId),
  )

  const value = createMemo<TrackingTimeTravelVM | null>(() => {
    const response = timeTravelResponse()
    if (!response) return null
    return toTrackingTimeTravelVm(response, locale())
  })

  createEffect(() => {
    const containerId = command.selectedContainer()?.id ?? null
    if (!isActive()) {
      setActiveContainerId(containerId)
      return
    }

    if (containerId !== activeContainerId()) {
      setActiveContainerId(containerId)
      setSelectedSnapshotId('')
      setIsDebugOpen(false)
    }
  })

  createEffect(() => {
    if (!isActive()) {
      setSelectedSnapshotId('')
      setIsDebugOpen(false)
      return
    }

    const vm = value()
    if (!vm) return

    const currentSelection = selectedSnapshotId()
    const hasCurrentSelection = vm.syncs.some((sync) => sync.snapshotId === currentSelection)
    if (hasCurrentSelection) return

    setSelectedSnapshotId(vm.selectedSnapshotId ?? '')
  })

  const selectedSync = createMemo(() => {
    const vm = value()
    if (!vm) return null
    return findTrackingTimeTravelSync(vm.syncs, selectedSnapshotId())
  })

  const [debugResponse] = createResource(
    () => {
      const container = command.selectedContainer()
      const sync = selectedSync()
      if (!isActive() || !isDebugOpen() || !container || !sync) return null
      return {
        containerId: container.id,
        snapshotId: sync.snapshotId,
      }
    },
    async (request) => fetchTrackingReplayDebug(request.containerId, request.snapshotId),
  )

  const debugValue = createMemo<TrackingReplayDebugVM | null>(() => {
    const response = debugResponse()
    if (!response) return null
    return toTrackingReplayDebugVm(response, locale())
  })

  const open = () => {
    if (!command.selectedContainer()) return
    setIsActive(true)
    setIsDebugOpen(false)
  }

  const close = () => {
    setIsActive(false)
    setIsDebugOpen(false)
    setSelectedSnapshotId('')
  }

  const toggleDebug = () => {
    setIsDebugOpen((current) => !current)
  }

  const selectSnapshot = (snapshotId: string) => {
    setSelectedSnapshotId(snapshotId)
  }

  const selectPrevious = () => {
    const vm = value()
    const currentSnapshotId = selectedSnapshotId()
    if (!vm || currentSnapshotId.length === 0) return
    const previousSnapshotId = selectAdjacentTrackingTimeTravelSnapshotId({
      syncs: vm.syncs,
      currentSnapshotId,
      direction: 'previous',
    })
    if (!previousSnapshotId) return
    setSelectedSnapshotId(previousSnapshotId)
  }

  const selectNext = () => {
    const vm = value()
    const currentSnapshotId = selectedSnapshotId()
    if (!vm || currentSnapshotId.length === 0) return
    const nextSnapshotId = selectAdjacentTrackingTimeTravelSnapshotId({
      syncs: vm.syncs,
      currentSnapshotId,
      direction: 'next',
    })
    if (!nextSnapshotId) return
    setSelectedSnapshotId(nextSnapshotId)
  }

  return {
    isActive,
    isLoading: () => isActive() && timeTravelResponse.loading,
    errorMessage: () => {
      const error = timeTravelResponse.error
      return error ? toReadableErrorMessage(error) : null
    },
    value,
    selectedSync,
    isDebugOpen,
    isDebugLoading: () => isDebugOpen() && debugResponse.loading,
    debugErrorMessage: () => {
      const error = debugResponse.error
      return error ? toReadableErrorMessage(error) : null
    },
    debugValue,
    debugPayload: () => debugResponse() ?? null,
    open,
    close,
    toggleDebug,
    selectSnapshot,
    selectPrevious,
    selectNext,
  }
}
