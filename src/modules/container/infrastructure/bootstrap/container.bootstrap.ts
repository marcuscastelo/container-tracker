import { createContainerUseCases } from '~/modules/container/application/container.usecases'
import { supabaseContainerRepository } from '~/modules/container/infrastructure/persistence/container.repository.supabase'

export const containerUseCases = createContainerUseCases({
  repository: supabaseContainerRepository,
})
