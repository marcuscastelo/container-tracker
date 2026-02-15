// src/modules/search/interface/http/search.controllers.bootstrap.ts
//
// Composition root for the Search controllers.
// Wires controllers with the search use cases.

import { searchUseCases } from '~/modules/search/infrastructure/bootstrap/search.bootstrap'
import { createSearchControllers } from '~/modules/search/interface/http/search.controllers'

export const searchControllers = createSearchControllers({
  searchUseCases,
})
