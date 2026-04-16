export type ResourceSnapshotLike<T> = {
  readonly state: 'unresolved' | 'pending' | 'ready' | 'refreshing' | 'errored'
  readonly latest: T | undefined
}

export function readResourceSnapshot<T>(resource: ResourceSnapshotLike<T>): T | undefined {
  if (resource.state === 'ready' || resource.state === 'refreshing') {
    return resource.latest
  }

  return undefined
}
