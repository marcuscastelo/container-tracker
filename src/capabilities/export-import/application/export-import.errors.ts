import { HttpError } from '~/shared/errors/httpErrors'

export const IMPORT_REQUIRES_EMPTY_DATABASE = 'IMPORT_REQUIRES_EMPTY_DATABASE'

export class ImportRequiresEmptyDatabaseError extends HttpError {
  constructor() {
    super(
      `${IMPORT_REQUIRES_EMPTY_DATABASE}: Symmetric import v1 requires an empty process database. Remove existing processes before importing.`,
      409,
    )
    this.name = 'ImportRequiresEmptyDatabaseError'
  }
}

export class InvalidSymmetricBundleError extends HttpError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'InvalidSymmetricBundleError'
  }
}

export class ProcessNotFoundError extends HttpError {
  constructor(message = 'Process not found for export') {
    super(message, 404)
    this.name = 'ProcessNotFoundError'
  }
}
