export type CreateProcessCloseGuardFormSnapshot = {
  readonly reference: string
  readonly origin: string
  readonly destination: string
  readonly containers: readonly string[]
  readonly carrier: string
  readonly billOfLading: string
  readonly bookingNumber: string
  readonly importerName: string
  readonly exporterName: string
  readonly referenceImporter: string
  readonly depositary: string
  readonly product: string
  readonly redestinationNumber: string
}

type SmartPasteCloseGuardSnapshot = {
  readonly rawText: string
  readonly hasParsed: boolean
}

function areContainersEqual(current: readonly string[], baseline: readonly string[]): boolean {
  if (current.length !== baseline.length) return false
  return current.every((value, index) => value === baseline[index])
}

export function createDefaultCreateProcessCloseGuardFormSnapshot(): CreateProcessCloseGuardFormSnapshot {
  return {
    reference: '',
    origin: '',
    destination: '',
    containers: [''],
    carrier: '',
    billOfLading: '',
    bookingNumber: '',
    importerName: '',
    exporterName: '',
    referenceImporter: '',
    depositary: '',
    product: '',
    redestinationNumber: '',
  }
}

export function isCreateProcessCloseGuardFormDirty(params: {
  readonly current: CreateProcessCloseGuardFormSnapshot
  readonly baseline: CreateProcessCloseGuardFormSnapshot
}): boolean {
  if (params.current.reference !== params.baseline.reference) return true
  if (params.current.origin !== params.baseline.origin) return true
  if (params.current.destination !== params.baseline.destination) return true
  if (!areContainersEqual(params.current.containers, params.baseline.containers)) return true
  if (params.current.carrier !== params.baseline.carrier) return true
  if (params.current.billOfLading !== params.baseline.billOfLading) return true
  if (params.current.bookingNumber !== params.baseline.bookingNumber) return true
  if (params.current.importerName !== params.baseline.importerName) return true
  if (params.current.exporterName !== params.baseline.exporterName) return true
  if (params.current.referenceImporter !== params.baseline.referenceImporter) return true
  if (params.current.depositary !== params.baseline.depositary) return true
  if (params.current.product !== params.baseline.product) return true
  if (params.current.redestinationNumber !== params.baseline.redestinationNumber) return true
  return false
}

export function isSmartPasteCloseGuardDirty(snapshot: SmartPasteCloseGuardSnapshot): boolean {
  return snapshot.rawText.trim().length > 0 || snapshot.hasParsed
}
