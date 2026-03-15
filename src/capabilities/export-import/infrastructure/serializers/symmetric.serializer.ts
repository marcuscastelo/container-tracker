import { PassThrough } from 'node:stream'
import archiver from 'archiver'
import type {
  SymmetricExportBundle,
  SymmetricExportFormat,
} from '~/capabilities/export-import/application/export-import.models'

type SerializedExportFile = {
  readonly filename: string
  readonly contentType: string
  readonly content: Uint8Array
}

async function archiveFiles(command: {
  readonly files: readonly { readonly name: string; readonly content: string }[]
}): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    const chunks: Buffer[] = []
    const output = new PassThrough()

    output.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    output.on('error', (error: Error) => {
      reject(error)
    })

    output.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    archive.on('error', (error: Error) => {
      reject(error)
    })

    archive.pipe(output)

    for (const file of command.files) {
      archive.append(file.content, { name: file.name })
    }

    void archive.finalize()
  })
}

function toIsoDatePart(isoString: string): string {
  return isoString.slice(0, 10)
}

export async function serializeSymmetricExport(command: {
  readonly bundle: SymmetricExportBundle
  readonly format: SymmetricExportFormat
}): Promise<SerializedExportFile> {
  const datePart = toIsoDatePart(command.bundle.exportedAt)
  const baseFilename = `portable-export-${datePart}`
  const bundleJson = JSON.stringify(command.bundle, null, 2)

  if (command.format === 'json') {
    return {
      filename: `${baseFilename}.json`,
      contentType: 'application/json',
      content: Buffer.from(bundleJson, 'utf-8'),
    }
  }

  const content = await archiveFiles({
    files: [
      {
        name: 'manifest.json',
        content: JSON.stringify(command.bundle.manifest, null, 2),
      },
      {
        name: 'processes.json',
        content: bundleJson,
      },
    ],
  })

  return {
    filename: `${baseFilename}.zip`,
    contentType: 'application/zip',
    content,
  }
}
