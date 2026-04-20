import { createAccessUseCases } from '~/modules/access/application/access.usecases'
import { supabaseAccessRepository } from '~/modules/access/infrastructure/persistence/access.repository.supabase'
import { createAccessControllers } from '~/modules/access/interface/http/access.controllers'
import { serverEnv } from '~/shared/config/server-env'

const supabaseJwtSecret = serverEnv.SUPABASE_JWT_SECRET
if (!supabaseJwtSecret) {
  throw new Error('Missing SUPABASE_JWT_SECRET for access bridge-session')
}

export const accessControllers = createAccessControllers({
  accessUseCases: createAccessUseCases({
    repository: supabaseAccessRepository,
    supabaseJwtSecret,
  }),
})
