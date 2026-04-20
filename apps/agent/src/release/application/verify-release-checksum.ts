import { createHash } from 'node:crypto'

function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export function verifyReleaseChecksum(command: {
  readonly version: string
  readonly payload: Buffer
  readonly expectedChecksum: string
}): void {
  const observedChecksum = computeSha256(command.payload).toLowerCase()
  const expectedChecksum = command.expectedChecksum.toLowerCase()
  if (observedChecksum !== expectedChecksum) {
    throw new Error(
      `checksum mismatch for ${command.version}: expected ${expectedChecksum}, got ${observedChecksum}`,
    )
  }
}
