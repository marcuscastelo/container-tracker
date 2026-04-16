import type { JSX } from 'solid-js'
import { For } from 'solid-js'

function SkeletonLine(props: { readonly class: string }): JSX.Element {
  return <div class={`animate-pulse rounded bg-surface-muted ${props.class}`} />
}

function SkeletonCard(props: {
  readonly children: JSX.Element
  readonly class?: string
}): JSX.Element {
  return (
    <section
      class={`rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0_/8%)] ${props.class ?? ''}`}
    >
      {props.children}
    </section>
  )
}

const CONTAINER_SKELETON_KEYS = [
  'shipment-container-skeleton-1',
  'shipment-container-skeleton-2',
  'shipment-container-skeleton-3',
] as const

const TIMELINE_SKELETON_KEYS = [
  'shipment-timeline-skeleton-1',
  'shipment-timeline-skeleton-2',
  'shipment-timeline-skeleton-3',
  'shipment-timeline-skeleton-4',
  'shipment-timeline-skeleton-5',
] as const

const SIDEBAR_SKELETON_KEYS = [
  'shipment-sidebar-skeleton-1',
  'shipment-sidebar-skeleton-2',
  'shipment-sidebar-skeleton-3',
] as const

function ShipmentHeaderSkeleton(): JSX.Element {
  return (
    <SkeletonCard>
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="space-y-3">
          <SkeletonLine class="h-4 w-24" />
          <SkeletonLine class="h-8 w-56" />
          <SkeletonLine class="h-4 w-40" />
        </div>
        <div class="flex flex-wrap gap-2">
          <SkeletonLine class="h-10 w-28" />
          <SkeletonLine class="h-10 w-32" />
          <SkeletonLine class="h-10 w-24" />
        </div>
      </div>
    </SkeletonCard>
  )
}

function ShipmentCurrentAlertsSkeleton(): JSX.Element {
  return (
    <SkeletonCard>
      <div class="flex flex-wrap gap-2">
        <SkeletonLine class="h-9 w-32" />
        <SkeletonLine class="h-9 w-28" />
        <SkeletonLine class="h-9 w-24" />
      </div>
    </SkeletonCard>
  )
}

function ShipmentTimeTravelToggleSkeleton(): JSX.Element {
  return (
    <div class="flex justify-end">
      <SkeletonLine class="h-10 w-36" />
    </div>
  )
}

function ContainerSkeletonItem(): JSX.Element {
  return (
    <div class="rounded-lg border border-border/70 bg-surface-muted/40 p-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="space-y-2">
          <SkeletonLine class="h-4 w-28" />
          <SkeletonLine class="h-3 w-40" />
        </div>
        <div class="space-y-2">
          <SkeletonLine class="ml-auto h-3 w-20" />
          <SkeletonLine class="ml-auto h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

function ShipmentContainersSkeleton(): JSX.Element {
  return (
    <SkeletonCard>
      <div class="mb-4 flex items-center justify-between gap-3">
        <SkeletonLine class="h-5 w-32" />
        <SkeletonLine class="h-4 w-24" />
      </div>
      <div class="space-y-3">
        <For each={CONTAINER_SKELETON_KEYS}>
          {(key) => (
            <div data-key={key}>
              <ContainerSkeletonItem />
            </div>
          )}
        </For>
      </div>
    </SkeletonCard>
  )
}

function TimelineSkeletonItem(): JSX.Element {
  return (
    <div class="flex gap-3">
      <div class="flex flex-col items-center">
        <SkeletonLine class="h-8 w-8 rounded-full" />
        <SkeletonLine class="mt-2 h-16 w-px" />
      </div>
      <div class="min-w-0 flex-1 rounded-lg border border-border/70 bg-surface-muted/40 p-3">
        <SkeletonLine class="h-4 w-40" />
        <SkeletonLine class="mt-2 h-3 w-28" />
        <SkeletonLine class="mt-3 h-3 w-full" />
        <SkeletonLine class="mt-2 h-3 w-2/3" />
      </div>
    </div>
  )
}

function ShipmentTimelineSkeleton(): JSX.Element {
  return (
    <SkeletonCard>
      <div class="mb-4 flex items-center justify-between gap-3">
        <SkeletonLine class="h-5 w-36" />
        <SkeletonLine class="h-4 w-24" />
      </div>
      <div class="space-y-4">
        <For each={TIMELINE_SKELETON_KEYS}>
          {(key) => (
            <div data-key={key}>
              <TimelineSkeletonItem />
            </div>
          )}
        </For>
      </div>
    </SkeletonCard>
  )
}

function ShipmentSidebarSkeleton(): JSX.Element {
  return (
    <div class="space-y-4">
      <For each={SIDEBAR_SKELETON_KEYS}>
        {(key) => (
          <div data-key={key}>
            <SkeletonCard>
              <SkeletonLine class="h-5 w-28" />
              <div class="mt-4 space-y-3">
                <SkeletonLine class="h-4 w-full" />
                <SkeletonLine class="h-4 w-5/6" />
                <SkeletonLine class="h-4 w-2/3" />
              </div>
            </SkeletonCard>
          </div>
        )}
      </For>
    </div>
  )
}

export function ShipmentScreenSkeleton(): JSX.Element {
  return (
    <div class="space-y-4" aria-hidden="true">
      <ShipmentHeaderSkeleton />
      <ShipmentCurrentAlertsSkeleton />
      <ShipmentTimeTravelToggleSkeleton />

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-4">
          <ShipmentContainersSkeleton />
          <ShipmentTimelineSkeleton />
        </div>

        <ShipmentSidebarSkeleton />
      </div>
    </div>
  )
}
