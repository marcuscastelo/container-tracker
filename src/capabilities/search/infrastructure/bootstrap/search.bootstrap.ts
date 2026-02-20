// src/modules/search/infrastructure/bootstrap/search.bootstrap.ts
//
// Composition root for the Search module.
// Wires the Supabase search repository to the search use cases.

import { createSearchUseCases } from '~/capabilities/search/application/search.usecases'
import { supabaseSearchRepository } from '~/capabilities/search/infrastructure/persistence/supabaseSearchRepository'

export const searchUseCases = createSearchUseCases({
  repository: supabaseSearchRepository,
})
