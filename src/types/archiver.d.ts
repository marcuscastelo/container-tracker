declare module 'archiver' {
  import type { Transform } from 'node:stream'

  type Archiver = Transform & {
    append(source: string | Buffer, data: { readonly name: string }): void
    finalize(): Promise<void>
    on(event: 'error', listener: (error: Error) => void): Archiver
    pipe(destination: NodeJS.WritableStream): NodeJS.WritableStream
  }

  function archiver(
    format: 'zip',
    options?: {
      readonly zlib?: {
        readonly level?: number
      }
    },
  ): Archiver

  export = archiver
}
