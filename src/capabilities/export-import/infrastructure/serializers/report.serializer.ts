import { PassThrough } from 'node:stream'
import archiver from 'archiver'
import type {
  OperationalSnapshotReport,
  ReportFormat,
} from '~/capabilities/export-import/application/export-import.models'
import { buildTrelloMarkdownFiles } from '~/capabilities/export-import/infrastructure/serializers/report-trello-markdown.serializer'
import type { TemporalValueDto } from '~/shared/time/dto'

type SerializedExportFile = {
  readonly filename: string
  readonly contentType: string
  readonly content: Uint8Array
}

const MAX_PDF_LINES = 45

function toIsoDatePart(isoString: string): string {
  return isoString.slice(0, 10)
}

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}

function stringifyTemporalValue(value: TemporalValueDto | null): string {
  return value?.value ?? ''
}

function toFlatRows(report: OperationalSnapshotReport): readonly string[][] {
  const header = [
    'process_reference',
    'carrier',
    'origin',
    'destination',
    'process_status',
    'alerts_count',
    'eta',
    'last_event_at',
    'last_sync_at',
    'container_number',
    'container_status',
    'container_eta',
    'container_latest_event',
    'container_has_conflict',
  ]

  const rows: string[][] = [header]

  for (const processEntry of report.processes) {
    if (processEntry.containers.length === 0) {
      rows.push([
        processEntry.reference ?? '',
        processEntry.carrier ?? '',
        processEntry.origin ?? '',
        processEntry.destination ?? '',
        processEntry.processStatus,
        String(processEntry.alertCount),
        stringifyTemporalValue(processEntry.eta),
        stringifyTemporalValue(processEntry.lastEventAt),
        processEntry.lastSyncAt ?? '',
        '',
        '',
        '',
        '',
        '',
      ])
      continue
    }

    for (const container of processEntry.containers) {
      rows.push([
        processEntry.reference ?? '',
        processEntry.carrier ?? '',
        processEntry.origin ?? '',
        processEntry.destination ?? '',
        processEntry.processStatus,
        String(processEntry.alertCount),
        stringifyTemporalValue(processEntry.eta),
        stringifyTemporalValue(processEntry.lastEventAt),
        processEntry.lastSyncAt ?? '',
        container.containerNumber,
        container.status,
        stringifyTemporalValue(container.eta),
        stringifyTemporalValue(container.latestEvent),
        container.hasConflict ? 'true' : 'false',
      ])
    }
  }

  return rows
}

function serializeCsv(report: OperationalSnapshotReport): Uint8Array {
  const rows = toFlatRows(report)
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
  return Buffer.from(csv, 'utf-8')
}

function serializeMarkdown(report: OperationalSnapshotReport): Uint8Array {
  const lines: string[] = []
  lines.push('# Operational Snapshot Report')
  lines.push('')
  lines.push(`- Exported at: ${report.exportedAt}`)
  lines.push(`- Timezone: ${report.timezone}`)
  lines.push(`- Total processes: ${report.totals.processCount}`)
  lines.push(`- Total containers: ${report.totals.containerCount}`)
  lines.push('')
  lines.push('## Executive summary')
  lines.push('')
  lines.push(`- In transit: ${report.totals.inTransitProcesses}`)
  lines.push(`- With alerts: ${report.totals.processesWithAlerts}`)
  lines.push(`- Delivered: ${report.totals.deliveredProcesses}`)
  lines.push(`- With conflict: ${report.totals.processesWithConflict}`)
  lines.push(`- Without recent sync: ${report.totals.processesWithoutRecentSync}`)
  lines.push('')
  lines.push('## Consolidated table')
  lines.push('')
  lines.push('| Process | Status | Containers | Alerts | ETA | Last event | Last sync |')
  lines.push('|---|---|---:|---:|---|---|---|')

  for (const processEntry of report.processes) {
    lines.push(
      `| ${processEntry.reference ?? '-'} | ${processEntry.processStatus} | ${processEntry.containers.length} | ${processEntry.alertCount} | ${stringifyTemporalValue(processEntry.eta) || '-'} | ${stringifyTemporalValue(processEntry.lastEventAt) || '-'} | ${processEntry.lastSyncAt ?? '-'} |`,
    )
  }

  lines.push('')
  lines.push('## Methodological notes')
  lines.push('')
  for (const note of report.methodologicalNotes) {
    lines.push(`- ${note}`)
  }

  return Buffer.from(lines.join('\n'), 'utf-8')
}

function escapePdfText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

function serializeSimplePdf(report: OperationalSnapshotReport): Uint8Array {
  const markdownText = Buffer.from(serializeMarkdown(report)).toString('utf-8')
  const sourceLines = markdownText.split('\n').slice(0, MAX_PDF_LINES)

  const streamLines = ['BT', '/F1 11 Tf', '50 780 Td', '14 TL']
  for (const line of sourceLines) {
    streamLines.push(`(${escapePdfText(line)}) Tj`)
    streamLines.push('T*')
  }
  streamLines.push('ET')

  const contentStream = `${streamLines.join('\n')}\n`

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf-8')} >>\nstream\n${contentStream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  const pdfHeader = '%PDF-1.4\n'
  const chunks: string[] = [pdfHeader]
  const offsets: number[] = [0]
  let currentLength = Buffer.byteLength(pdfHeader, 'utf-8')

  for (const objectContent of objects) {
    offsets.push(currentLength)
    chunks.push(objectContent)
    currentLength += Buffer.byteLength(objectContent, 'utf-8')
  }

  const xrefOffset = currentLength
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ']
  for (let index = 1; index <= objects.length; index += 1) {
    const offset = offsets[index] ?? 0
    xrefLines.push(`${String(offset).padStart(10, '0')} 00000 n `)
  }

  const trailer = [
    ...xrefLines,
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n')

  chunks.push(`${trailer}\n`)

  return Buffer.from(chunks.join(''), 'utf-8')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function toSpreadsheetColumnName(columnIndex: number): string {
  let index = columnIndex
  let label = ''

  while (index >= 0) {
    const remainder = index % 26
    label = `${String.fromCharCode(65 + remainder)}${label}`
    index = Math.floor(index / 26) - 1
  }

  return label
}

async function archiveXlsx(rows: readonly string[][]): Promise<Uint8Array> {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, columnIndex) => {
          const cellRef = `${toSpreadsheetColumnName(columnIndex)}${rowIndex + 1}`
          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')

  const files = [
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Snapshot" sheetId="1" r:id="rId1"/></sheets>' +
        '</workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRows}</sheetData>` +
        '</worksheet>',
    },
  ]

  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })
    const output = new PassThrough()
    const chunks: Buffer[] = []

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

    for (const file of files) {
      archive.append(file.content, { name: file.name })
    }

    void archive.finalize()
  })
}

async function archiveTextFiles(command: {
  readonly files: readonly { readonly name: string; readonly content: string }[]
}): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })
    const output = new PassThrough()
    const chunks: Buffer[] = []

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

export async function serializeReportExport(command: {
  readonly report: OperationalSnapshotReport
  readonly format: ReportFormat
}): Promise<SerializedExportFile> {
  const datePart = toIsoDatePart(command.report.exportedAt)
  const rows = toFlatRows(command.report)

  switch (command.format) {
    case 'json':
      return {
        filename: `processes-report-${datePart}.json`,
        contentType: 'application/json',
        content: Buffer.from(JSON.stringify(command.report, null, 2), 'utf-8'),
      }
    case 'csv':
      return {
        filename: `processes-report-${datePart}.csv`,
        contentType: 'text/csv; charset=utf-8',
        content: serializeCsv(command.report),
      }
    case 'xlsx':
      return {
        filename: `processes-report-${datePart}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: await archiveXlsx(rows),
      }
    case 'markdown':
      return {
        filename: `processes-report-${datePart}.md`,
        contentType: 'text/markdown; charset=utf-8',
        content: serializeMarkdown(command.report),
      }
    case 'pdf':
      return {
        filename: `processes-report-${datePart}.pdf`,
        contentType: 'application/pdf',
        content: serializeSimplePdf(command.report),
      }
    case 'trello': {
      const trelloFiles = buildTrelloMarkdownFiles(command.report)
      if (command.report.scope === 'single_process') {
        const firstFile = trelloFiles[0]
        return {
          filename: firstFile?.name ?? `snapshot-process-${datePart}.md`,
          contentType: 'text/markdown; charset=utf-8',
          content: Buffer.from(firstFile?.content ?? '', 'utf-8'),
        }
      }

      return {
        filename: `trello-export-${datePart}.zip`,
        contentType: 'application/zip',
        content: await archiveTextFiles({
          files: trelloFiles,
        }),
      }
    }
  }
}
