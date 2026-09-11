import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { ApiError, asyncHandler } from '../errors.js'
import { validServiceSecret } from '../internalAuth.js'
import { rotateStoreForAllUsers } from '../storeRotation.js'

/** Creates the protected router mounted at `/api/v1/internal`. */
export function createStoreInternalRouter(cronSecret: string) {
  const router = Router()
  router.use((request: Request, _response: Response, next: NextFunction) => {
    const provided = request.header('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    next(validServiceSecret(provided, cronSecret)
      ? undefined
      : new ApiError(401, 'INVALID_CRON_SECRET', 'La credencial interna no es válida.'))
  })

  const rotateHandler = asyncHandler(async (request, response) => {
    const parsedLimit = z.coerce.number().int().min(1).max(10_000).optional().safeParse(request.query.limit)
    if (!parsedLimit.success) throw new ApiError(400, 'INVALID_JOB_LIMIT', 'El límite del trabajo interno no es válido.')
    const result = await rotateStoreForAllUsers(parsedLimit.data === undefined ? {} : { limit: parsedLimit.data })
    response.status(result.failed.length ? 207 : 200).json({ data: result, meta: {} })
  })
  router.get('/jobs/rotate-store', rotateHandler)
  router.post('/jobs/rotate-store', rotateHandler)
  return router
}
