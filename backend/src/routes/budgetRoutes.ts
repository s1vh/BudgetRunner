import { randomUUID } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { type AppRequest, requireAuth } from '../auth.js'
import {
  activateDueBudgets,
  closeDueBudgetPeriods,
  createBudgetPeriod,
  createResumedBudgetPeriod,
  evaluateDueBudgetPeriod,
  type BudgetTemplateRow,
} from '../budgetEngine.js'
import { getBudgetPeriodDetail, getBudgetPeriods, getBudgets } from '../budgetReadModel.js'
import { type DbClient, pool, withTransaction } from '../db.js'
import { ApiError, asyncHandler } from '../errors.js'
import { validServiceSecret } from '../internalAuth.js'

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/u

function validLocalDate(value: string) {
  if (!localDatePattern.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === (month ?? 0) - 1 && parsed.getUTCDate() === day
}

const budgetSchema = z.object({
  name: z.string().trim().min(3).max(100),
  frequency: z.enum(['weekly', 'monthly']),
  scope: z.enum(['global', 'category']),
  categoryId: z.string().uuid().nullable().optional(),
  limitMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  startsOn: z.string().refine(validLocalDate, 'A valid calendar date is required.'),
}).superRefine((input, context) => {
  if (input.scope === 'category' && !input.categoryId) {
    context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required.' })
  }
  if (input.scope === 'global' && input.categoryId) {
    context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Global budgets cannot have a category.' })
  }
})

const updateSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  frequency: z.enum(['weekly', 'monthly']).optional(),
  scope: z.enum(['global', 'category']).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  limitMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' })

function uuidParam(request: Request, name: string) {
  return z.string().uuid().parse(request.params[name])
}

function idempotencyKey(request: AppRequest) {
  const parsed = z.string().uuid().safeParse(request.header('idempotency-key'))
  if (!parsed.success) {
    throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'La cabecera Idempotency-Key debe contener un UUID.')
  }
  return parsed.data
}

async function previousResponse(client: DbClient, userId: string, scope: string, key: string) {
  const result = await client.query<{ response_status: number; response_body: unknown }>(`
    SELECT response_status, response_body
      FROM idempotency_records
     WHERE user_id = $1 AND scope = $2 AND idempotency_key = $3
  `, [userId, scope, key])
  return result.rows[0]
}

async function storeResponse(
  client: DbClient,
  userId: string,
  scope: string,
  key: string,
  status: number,
  body: unknown,
) {
  await client.query(`
    INSERT INTO idempotency_records
      (user_id, scope, idempotency_key, response_status, response_body)
    VALUES ($1, $2, $3, $4, $5)
  `, [userId, scope, key, status, body])
}

async function assertCategory(client: DbClient, userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return
  const category = await client.query(`
    SELECT 1 FROM categories
     WHERE id = $1 AND user_id = $2 AND is_archived = false
  `, [categoryId, userId])
  if (!category.rowCount) {
    throw new ApiError(400, 'INVALID_BUDGET_CATEGORY', 'La categoría no existe o está archivada.')
  }
}

async function synchronizeUserBudgets(userId: string, requestId: string) {
  await closeDueBudgetPeriods({ userId, limit: 100, requestId })
  await activateDueBudgets(userId)
}

export const budgetRouter = Router()
budgetRouter.use(requireAuth)

budgetRouter.get('/budgets', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  await synchronizeUserBudgets(appRequest.userId, appRequest.requestId)
  response.json({ data: await getBudgets(pool, appRequest.userId), meta: {} })
}))

budgetRouter.post('/budgets', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const input = budgetSchema.parse(request.body)
  const key = idempotencyKey(appRequest)
  const result = await withTransaction(async (client) => {
    const user = await client.query<{ timezone: string; local_date: string }>(`
      SELECT users.timezone,
             (now() AT TIME ZONE timezone.name)::date::text AS local_date
        FROM users
        JOIN pg_timezone_names timezone ON timezone.name = users.timezone
       WHERE users.id = $1 AND users.deleted_at IS NULL
       FOR UPDATE OF users
    `, [appRequest.userId])
    const owner = user.rows[0]
    if (!owner) throw new ApiError(422, 'INVALID_USER_TIMEZONE', 'La zona horaria del perfil no es válida.')
    const previous = await previousResponse(client, appRequest.userId, 'budgets:create', key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    await assertCategory(client, appRequest.userId, input.categoryId)
    if (input.startsOn < owner.local_date) {
      throw new ApiError(422, 'BUDGET_START_IN_PAST', 'Un presupuesto nuevo no puede comenzar en una fecha pasada.')
    }
    const inserted = await client.query<BudgetTemplateRow>(`
      INSERT INTO budgets
        (user_id, name, frequency, scope, category_id, limit_minor, currency, status, starts_on, timezone_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
      RETURNING id,
                user_id,
                frequency::text,
                scope::text,
                category_id,
                status::text,
                limit_minor::text,
                currency,
                starts_on::text,
                timezone_snapshot
    `, [
      appRequest.userId,
      input.name,
      input.frequency,
      input.scope,
      input.categoryId ?? null,
      input.limitMinor,
      input.currency,
      input.startsOn,
      owner.timezone,
    ])
    const budget = inserted.rows[0]
    if (!budget) throw new Error('Budget insert failed')
    const period = await createBudgetPeriod(client, budget, input.startsOn)
    if (period.startsAt.getTime() <= Date.now()) {
      await client.query("UPDATE budgets SET status = 'active' WHERE id = $1", [budget.id])
    }
    await client.query(`
      INSERT INTO audit_events
        (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'budget.created', 'budget', $2, $3,
        jsonb_build_object('frequency', $4::text, 'scope', $5::text))
    `, [appRequest.userId, budget.id, appRequest.requestId, input.frequency, input.scope])
    const saved = (await getBudgets(client, appRequest.userId, budget.id))[0]
    if (!saved) throw new Error('Created budget read model missing')
    const body = { data: saved, meta: {} }
    await storeResponse(client, appRequest.userId, 'budgets:create', key, 201, body)
    // Make a concurrent waiter restart its serializable snapshot and replay the
    // idempotency record instead of surfacing the unique-index race.
    await client.query('UPDATE users SET updated_at = now() WHERE id = $1', [appRequest.userId])
    return { status: 201, body }
  })
  response.status(result.status).json(result.body)
}))

budgetRouter.get('/budgets/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  await synchronizeUserBudgets(appRequest.userId, appRequest.requestId)
  const budget = (await getBudgets(pool, appRequest.userId, uuidParam(request, 'id')))[0]
  if (!budget) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
  response.json({ data: budget, meta: {} })
}))

budgetRouter.patch('/budgets/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const budgetId = uuidParam(request, 'id')
  const input = updateSchema.parse(request.body)
  const budget = await withTransaction(async (client) => {
    const current = await client.query<BudgetTemplateRow & { name: string }>(`
      SELECT id,
             user_id,
             name,
             frequency::text,
             scope::text,
             category_id,
             status::text,
             limit_minor::text,
             currency,
             starts_on::text,
             timezone_snapshot
        FROM budgets
       WHERE id = $1 AND user_id = $2
       FOR UPDATE
    `, [budgetId, appRequest.userId])
    const existing = current.rows[0]
    if (!existing) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
    if (existing.status === 'archived') {
      throw new ApiError(409, 'BUDGET_ARCHIVED', 'Un presupuesto archivado no se puede modificar.')
    }
    const nextScope = input.scope ?? existing.scope
    const nextCategoryId = input.categoryId !== undefined ? input.categoryId : existing.category_id
    if (nextScope === 'category' && !nextCategoryId) {
      throw new ApiError(422, 'BUDGET_CATEGORY_REQUIRED', 'Un presupuesto por categoría necesita una categoría.')
    }
    if (nextScope === 'global' && nextCategoryId) {
      throw new ApiError(422, 'GLOBAL_BUDGET_CATEGORY_FORBIDDEN', 'Un presupuesto global no puede tener categoría.')
    }
    await assertCategory(client, appRequest.userId, nextCategoryId)
    await client.query(`
      UPDATE budgets
         SET name = $3,
             frequency = $4,
             scope = $5,
             category_id = $6,
             limit_minor = $7,
             currency = $8
       WHERE id = $1 AND user_id = $2
    `, [
      budgetId,
      appRequest.userId,
      input.name ?? existing.name,
      input.frequency ?? existing.frequency,
      nextScope,
      nextCategoryId,
      input.limitMinor ?? existing.limit_minor,
      input.currency ?? existing.currency,
    ])
    await client.query(`
      INSERT INTO audit_events
        (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'budget.updated', 'budget', $2, $3,
        jsonb_build_object('takesEffect', 'next_period'))
    `, [appRequest.userId, budgetId, appRequest.requestId])
    const saved = (await getBudgets(client, appRequest.userId, budgetId))[0]
    if (!saved) throw new Error('Updated budget read model missing')
    return saved
  })
  response.json({ data: budget, meta: {} })
}))

budgetRouter.post('/budgets/:id/pause', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const budgetId = uuidParam(request, 'id')
  const budget = await withTransaction(async (client) => {
    const current = await client.query<{ status: string }>(`
      SELECT status::text FROM budgets
       WHERE id = $1 AND user_id = $2
       FOR UPDATE
    `, [budgetId, appRequest.userId])
    const row = current.rows[0]
    if (!row) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
    if (row.status === 'archived') {
      throw new ApiError(409, 'BUDGET_NOT_PAUSABLE', 'El presupuesto no se puede pausar.')
    }
    if (row.status !== 'paused') {
      await client.query("UPDATE budgets SET status = 'paused' WHERE id = $1 AND user_id = $2", [budgetId, appRequest.userId])
      await client.query(`
        INSERT INTO audit_events
          (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
        VALUES ($1, 'user', 'budget.paused', 'budget', $2, $3,
          jsonb_build_object('openPeriodCommitted', true))
      `, [appRequest.userId, budgetId, appRequest.requestId])
    }
    const saved = (await getBudgets(client, appRequest.userId, budgetId))[0]
    if (!saved) throw new Error('Paused budget read model missing')
    return saved
  })
  response.json({ data: budget, meta: {} })
}))

budgetRouter.post('/budgets/:id/resume', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const budgetId = uuidParam(request, 'id')
  await closeDueBudgetPeriods({ userId: appRequest.userId, limit: 100, requestId: appRequest.requestId })
  const budget = await withTransaction(async (client) => {
    const current = await client.query<BudgetTemplateRow>(`
      SELECT id,
             user_id,
             frequency::text,
             scope::text,
             category_id,
             status::text,
             limit_minor::text,
             currency,
             starts_on::text,
             timezone_snapshot
        FROM budgets
       WHERE id = $1 AND user_id = $2
       FOR UPDATE
    `, [budgetId, appRequest.userId])
    const existing = current.rows[0]
    if (!existing) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
    if (existing.status === 'archived') {
      throw new ApiError(409, 'BUDGET_NOT_RESUMABLE', 'El presupuesto no se puede reanudar.')
    }
    if (existing.status === 'paused') {
      if (existing.scope === 'category') {
        const category = await client.query(`
          SELECT 1 FROM categories
           WHERE id = $1 AND user_id = $2 AND is_archived = false
        `, [existing.category_id, appRequest.userId])
        if (!category.rowCount) {
          throw new ApiError(
            409,
            'BUDGET_CATEGORY_ARCHIVED',
            'El presupuesto no puede reanudarse porque su categoría está archivada.',
          )
        }
      }
      const open = await client.query<{ starts_at: Date }>(`
        SELECT starts_at FROM budget_periods
         WHERE budget_id = $1 AND status = 'open'
         ORDER BY starts_at DESC
         LIMIT 1
         FOR UPDATE
      `, [budgetId])
      const openPeriod = open.rows[0]
      if (openPeriod) {
        await client.query(`
          UPDATE budgets
             SET status = CASE WHEN $2 <= now() THEN 'active'::budget_status ELSE 'scheduled'::budget_status END
           WHERE id = $1
        `, [budgetId, openPeriod.starts_at])
      } else {
        await createResumedBudgetPeriod(client, existing)
      }
      await client.query(`
        INSERT INTO audit_events
          (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
        VALUES ($1, 'user', 'budget.resumed', 'budget', $2, $3, '{}'::jsonb)
      `, [appRequest.userId, budgetId, appRequest.requestId])
    }
    const saved = (await getBudgets(client, appRequest.userId, budgetId))[0]
    if (!saved) throw new Error('Resumed budget read model missing')
    return saved
  })
  response.json({ data: budget, meta: {} })
}))

budgetRouter.delete('/budgets/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const budgetId = uuidParam(request, 'id')
  await withTransaction(async (client) => {
    const current = await client.query<{ status: string }>(`
      SELECT status::text FROM budgets
       WHERE id = $1 AND user_id = $2
       FOR UPDATE
    `, [budgetId, appRequest.userId])
    const budget = current.rows[0]
    if (!budget) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
    if (budget.status !== 'archived') {
      await client.query(`
        UPDATE budgets
           SET status = 'archived', archived_at = now()
         WHERE id = $1 AND user_id = $2
      `, [budgetId, appRequest.userId])
      await client.query(`
        INSERT INTO audit_events
          (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
        VALUES ($1, 'user', 'budget.archived', 'budget', $2, $3,
          jsonb_build_object('openPeriodCommitted', true))
      `, [appRequest.userId, budgetId, appRequest.requestId])
    }
  })
  response.status(204).send()
}))

budgetRouter.get('/budgets/:id/periods', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const budgetId = uuidParam(request, 'id')
  const owned = await pool.query('SELECT 1 FROM budgets WHERE id = $1 AND user_id = $2', [budgetId, appRequest.userId])
  if (!owned.rowCount) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
  await synchronizeUserBudgets(appRequest.userId, appRequest.requestId)
  response.json({ data: await getBudgetPeriods(pool, appRequest.userId, budgetId), meta: {} })
}))

budgetRouter.get('/budget-periods/:periodId', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const periodId = uuidParam(request, 'periodId')
  await synchronizeUserBudgets(appRequest.userId, appRequest.requestId)
  response.json({ data: await getBudgetPeriodDetail(pool, appRequest.userId, periodId), meta: {} })
}))

export function createBudgetInternalRouter(cronSecret: string) {
  const router = Router()
  router.use((request: Request, _response: Response, next: NextFunction) => {
    const provided = request.header('authorization')?.replace(/^Bearer\s+/iu, '') ?? ''
    next(validServiceSecret(provided, cronSecret)
      ? undefined
      : new ApiError(401, 'INVALID_CRON_SECRET', 'La credencial interna no es válida.'))
  })

  const closeDueHandler = asyncHandler(async (request, response) => {
    const parsedLimit = z.coerce.number().int().min(1).max(100).optional().safeParse(request.query.limit)
    if (!parsedLimit.success) {
      throw new ApiError(400, 'INVALID_JOB_LIMIT', 'El límite del trabajo interno no es válido.')
    }
    const runId = randomUUID()
    const runKey = randomUUID()
    await pool.query(`
      INSERT INTO job_runs (id, job_type, idempotency_key, status)
      VALUES ($1, 'close_due_periods', $2, 'running')
    `, [runId, runKey])
    try {
      const results = await closeDueBudgetPeriods({
        limit: parsedLimit.data ?? 50,
        requestId: (request as AppRequest).requestId,
      })
      const failed = results.filter((item) => item.errorCode)
      await pool.query(`
        UPDATE job_runs
           SET status = $2,
               finished_at = now(),
               error_code = $3
         WHERE id = $1
      `, [runId, failed.length ? 'failed' : 'succeeded', failed.length ? 'PARTIAL_FAILURE' : null])
      response.status(failed.length ? 207 : 200).json({
        data: {
          runId,
          evaluated: results.filter((item) => item.evaluated).length,
          failed: failed.length,
          results,
        },
        meta: {},
      })
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
      await pool.query(`
        UPDATE job_runs
           SET status = 'failed', finished_at = now(), error_code = $2
         WHERE id = $1
      `, [runId, errorCode])
      throw error
    }
  })
  router.get('/jobs/close-due-periods', closeDueHandler)
  router.post('/jobs/close-due-periods', closeDueHandler)
  router.post('/budget-periods/:periodId/evaluate', asyncHandler(async (request, response) => {
    const result = await evaluateDueBudgetPeriod(uuidParam(request, 'periodId'), {
      requestId: (request as AppRequest).requestId,
    })
    response.json({ data: result, meta: {} })
  }))
  return router
}
