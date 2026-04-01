import type { Resource } from 'solid-js'

export function readResourceSnapshot<T>(resource: Resource<T>): T | undefined {
  if (resource.state === 'ready' || resource.state === 'refreshing') {
    return resource.latest
  }

  return undefined
}
