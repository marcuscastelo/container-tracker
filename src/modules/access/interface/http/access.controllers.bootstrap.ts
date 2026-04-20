import { createAccessUseCases } from '~/modules/access/application/access.usecases'
import { supabaseAccessRepository } from '~/modules/access/infrastructure/persistence/access.repository.supabase'
import { createAccessControllers } from '~/modules/access/interface/http/access.controllers'
import { serverEnv } from '~/shared/config/server-env'

export const accessControllers = createAccessControllers({
  accessUseCases: createAccessUseCases({
    repository: supabaseAccessRepository,
    supabaseJwtSecret: serverEnv.SUPABASE_JWT_SECRET ?? null,
  }),
})
