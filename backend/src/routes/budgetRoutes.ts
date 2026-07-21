import { timingSafeEqual } from 'node:crypto'
import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { type AppRequest, requireAuth } from '../auth.js'
import { activateDueBudgets, closeDueBudgetPeriods, createBudgetPeriod, evaluateBudgetPeriod } from '../budgetEngine.js'
import { config } from '../config.js'
import { type DbClient, pool, withTransaction } from '../db.js'
import { ApiError, asyncHandler } from '../errors.js'
import { rotateStoreForPeriod } from '../storeRotation.js'

const budgetSchema = z.object({
  name: z.string().trim().min(3).max(100),
  frequency: z.enum(['weekly', 'monthly']),
  scope: z.enum(['global', 'category']),
  categoryId: z.string().uuid().nullable().optional(),
  limitMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((input, context) => {
  if (input.scope === 'category' && !input.categoryId) context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required.' })
  if (input.scope === 'global' && input.categoryId) context.addIssue({ code: 'custom', path: ['categoryId'], message: 'Global budgets cannot have a category.' })
})

const updateSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  limitMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' })

function uuidParam(request: Request, name: string) {
  return z.string().uuid().parse(request.params[name])
}

interface BudgetDtoRow {
  id: string; name: string; frequency: string; scope: string; category_id: string | null; category_name: string | null;
  limit_minor: string; currency: string; budget_status: string; period_id: string; period_status: string;
  starts_at: Date; ends_at: Date; spend_minor: string; surplus_minor: string; eligible_surplus_minor: string;
  excluded_reward_minor: string; synthcoins_awarded: string; flux_awarded: number;
}

function budgetDto(row: BudgetDtoRow) {
  const budgetStatus = row.budget_status === 'paused' || row.budget_status === 'archived'
    ? row.budget_status
    : row.period_status === 'met' || row.period_status === 'exceeded'
      ? row.period_status
      : row.starts_at.getTime() > Date.now() ? 'scheduled' : 'active'
  return {
    id: row.id,
    name: row.name,
    frequency: row.frequency,
    scope: row.scope,
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    ...(row.category_name ? { categoryName: row.category_name } : {}),
    limitMinor: Number(row.limit_minor),
    spendMinor: Number(row.spend_minor),
    eligibleSurplusMinor: Number(row.eligible_surplus_minor),
    excludedRewardMinor: Number(row.excluded_reward_minor),
    currency: row.currency,
    status: budgetStatus,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    ...(Number(row.synthcoins_awarded) ? { synthcoinsAwarded: Number(row.synthcoins_awarded) } : {}),
    ...(row.flux_awarded ? { fluxAwarded: row.flux_awarded } : {}),
  }
}

async function getBudgets(client: DbClient, userId: string, budgetId?: string) {
  const result = await client.query<BudgetDtoRow>(`
    SELECT b.id, b.name, b.frequency::text, b.scope::text, b.category_id, c.name AS category_name,
           b.limit_minor::text, b.currency, b.status::text AS budget_status,
           p.id AS period_id, p.status::text AS period_status, p.starts_at, p.ends_at,
           CASE WHEN p.status = 'open' THEN live.spend_minor ELSE p.spend_minor END::text AS spend_minor,
           CASE WHEN p.status = 'open' THEN greatest(0, p.limit_minor_snapshot - live.spend_minor) ELSE p.surplus_minor END::text AS surplus_minor,
           CASE WHEN p.status = 'open' THEN greatest(0, p.limit_minor_snapshot - live.spend_minor - live.previously_allocated)
                ELSE p.eligible_surplus_minor END::text AS eligible_surplus_minor,
           CASE WHEN p.status = 'open' THEN least(greatest(0, p.limit_minor_snapshot - live.spend_minor), live.previously_allocated)
                ELSE p.excluded_reward_minor END::text AS excluded_reward_minor,
           p.synthcoins_awarded::text, p.flux_awarded
      FROM budgets b
      LEFT JOIN categories c ON c.id = b.category_id
      JOIN LATERAL (
        SELECT bp.* FROM budget_periods bp WHERE bp.budget_id = b.id
        ORDER BY bp.starts_at DESC LIMIT 1
      ) p ON true
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(t.amount_minor), 0)::bigint AS spend_minor,
               coalesce(sum((SELECT coalesce(sum(ra.allocated_minor), 0) FROM reward_allocations ra WHERE ra.transaction_id = t.id)), 0)::bigint AS previously_allocated
          FROM financial_transactions t
         WHERE t.user_id = b.user_id AND t.type = 'expense' AND t.status = 'posted'
           AND t.currency = p.currency_snapshot AND t.occurred_at >= p.starts_at AND t.occurred_at < p.ends_at
           AND (b.scope = 'global' OR t.category_id = b.category_id)
      ) live ON true
     WHERE b.user_id = $1 AND ($2::uuid IS NULL OR b.id = $2)
     ORDER BY CASE b.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
              p.ends_at, b.created_at
  `, [userId, budgetId ?? null])
  return result.rows.map(budgetDto)
}

async function assertCategory(client: DbClient, userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return
  const category = await client.query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2 AND is_archived = false', [categoryId, userId])
  if (!category.rowCount) throw new ApiError(400, 'INVALID_BUDGET_CATEGORY', 'La categoría no existe o está archivada.')
}

export const budgetRouter = Router()
budgetRouter.use(requireAuth)

budgetRouter.get('/budgets', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  await closeDueBudgetPeriods({ userId, limit: 20, requestId: (request as AppRequest).requestId })
  await activateDueBudgets(userId)
  response.json({ data: await getBudgets(pool, userId), meta: {} })
}))

budgetRouter.post('/budgets', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const input = budgetSchema.parse(request.body)
  const budgetId = await withTransaction(async (client) => {
    await assertCategory(client, appRequest.userId, input.categoryId)
    const user = await client.query<{ timezone: string }>('SELECT timezone FROM users WHERE id = $1 FOR UPDATE', [appRequest.userId])
    const timezone = user.rows[0]?.timezone
    if (!timezone) throw new ApiError(404, 'USER_NOT_FOUND', 'No se ha encontrado el usuario.')
    const inserted = await client.query<{
      id: string; user_id: string; frequency: 'weekly' | 'monthly'; status: 'scheduled' | 'active' | 'paused' | 'archived';
      limit_minor: string; currency: string; timezone_snapshot: string;
    }>(`
      INSERT INTO budgets (user_id, name, frequency, scope, category_id, limit_minor, currency, status, starts_on, timezone_snapshot)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9)
      RETURNING id, user_id, frequency::text, status::text, limit_minor::text, currency, timezone_snapshot
    `, [appRequest.userId, input.name, input.frequency, input.scope, input.categoryId ?? null, input.limitMinor, input.currency, input.startsOn, timezone])
    const budget = inserted.rows[0]
    if (!budget) throw new Error('Budget insert failed')
    const period = await createBudgetPeriod(client, budget, input.startsOn)
    if (period.starts_at.getTime() <= Date.now()) {
      await client.query("UPDATE budgets SET status = 'active' WHERE id = $1", [budget.id])
      await rotateStoreForPeriod(client, { userId: appRequest.userId, periodId: period.id, startsAt: period.starts_at, endsAt: period.ends_at })
    }
    await client.query(`INSERT INTO audit_events
      (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'budget.created', 'budget', $2, $3, jsonb_build_object('frequency', $4::text, 'scope', $5::text))`,
    [appRequest.userId, budget.id, appRequest.requestId, input.frequency, input.scope])
    return budget.id
  })
  const budget = (await getBudgets(pool, appRequest.userId, budgetId))[0]
  response.status(201).json({ data: budget, meta: {} })
}))

budgetRouter.get('/budgets/:id', asyncHandler(async (request, response) => {
  const budget = (await getBudgets(pool, (request as AppRequest).userId, uuidParam(request, 'id')))[0]
  if (!budget) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
  response.json({ data: budget, meta: {} })
}))

budgetRouter.patch('/budgets/:id', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const budgetId = uuidParam(request, 'id')
  const input = updateSchema.parse(request.body)
  const updated = await pool.query(`UPDATE budgets SET name = coalesce($3, name), limit_minor = coalesce($4, limit_minor),
    currency = coalesce($5, currency) WHERE id = $1 AND user_id = $2 AND status <> 'archived' RETURNING id`,
  [budgetId, userId, input.name ?? null, input.limitMinor ?? null, input.currency ?? null])
  if (!updated.rowCount) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
  response.json({ data: (await getBudgets(pool, userId, budgetId))[0], meta: {} })
}))

budgetRouter.post('/budgets/:id/pause', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const budgetId = uuidParam(request, 'id')
  const updated = await pool.query("UPDATE budgets SET status = 'paused' WHERE id = $1 AND user_id = $2 AND status IN ('active','scheduled') RETURNING id", [budgetId, userId])
  if (!updated.rowCount) throw new ApiError(409, 'BUDGET_NOT_PAUSABLE', 'El presupuesto no se puede pausar.')
  response.json({ data: (await getBudgets(pool, userId, budgetId))[0], meta: {} })
}))

budgetRouter.post('/budgets/:id/resume', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const budgetId = uuidParam(request, 'id')
  const updated = await pool.query(`UPDATE budgets b SET status = CASE WHEN (
      SELECT starts_at FROM budget_periods WHERE budget_id = b.id AND status = 'open' ORDER BY starts_at DESC LIMIT 1
    ) > now() THEN 'scheduled'::budget_status ELSE 'active'::budget_status END
    WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'paused'
      AND EXISTS (SELECT 1 FROM budget_periods WHERE budget_id = b.id AND status = 'open')
    RETURNING b.id`, [budgetId, userId])
  if (!updated.rowCount) throw new ApiError(409, 'BUDGET_NOT_RESUMABLE', 'El presupuesto no se puede reanudar.')
  await activateDueBudgets(userId)
  response.json({ data: (await getBudgets(pool, userId, budgetId))[0], meta: {} })
}))

budgetRouter.delete('/budgets/:id', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const archived = await withTransaction(async (client) => {
    const result = await client.query("UPDATE budgets SET status = 'archived', archived_at = now() WHERE id = $1 AND user_id = $2 AND status <> 'archived' RETURNING id", [request.params.id, userId])
    if (!result.rowCount) return false
    await client.query("UPDATE budget_periods SET status = 'cancelled' WHERE budget_id = $1 AND status = 'open'", [request.params.id])
    return true
  })
  if (!archived) throw new ApiError(404, 'BUDGET_NOT_FOUND', 'No se ha encontrado el presupuesto.')
  response.status(204).send()
}))

budgetRouter.get('/budgets/:id/periods', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const periods = await pool.query(`SELECT p.id, p.starts_at, p.ends_at, p.status::text, p.spend_minor::text,
    p.surplus_minor::text, p.eligible_surplus_minor::text, p.excluded_reward_minor::text,
    p.synthcoins_awarded::text, p.flux_awarded, p.excess_percent_bp, p.base_damage, p.evaluated_at
    FROM budget_periods p JOIN budgets b ON b.id = p.budget_id
    WHERE b.id = $1 AND b.user_id = $2 ORDER BY p.starts_at DESC`, [request.params.id, userId])
  response.json({ data: periods.rows.map((row) => ({ ...row,
    spendMinor: Number(row.spend_minor), surplusMinor: Number(row.surplus_minor), eligibleSurplusMinor: Number(row.eligible_surplus_minor),
    excludedRewardMinor: Number(row.excluded_reward_minor), synthcoinsAwarded: Number(row.synthcoins_awarded), fluxAwarded: row.flux_awarded,
    startsAt: (row.starts_at as Date).toISOString(), endsAt: (row.ends_at as Date).toISOString(),
    evaluatedAt: row.evaluated_at ? (row.evaluated_at as Date).toISOString() : null,
    spend_minor: undefined, surplus_minor: undefined, eligible_surplus_minor: undefined, excluded_reward_minor: undefined,
    synthcoins_awarded: undefined, flux_awarded: undefined, starts_at: undefined, ends_at: undefined, evaluated_at: undefined,
  })), meta: {} })
}))

budgetRouter.get('/budget-periods/:periodId', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const period = await pool.query(`SELECT p.*, b.name AS budget_name FROM budget_periods p JOIN budgets b ON b.id = p.budget_id
    WHERE p.id = $1 AND p.user_id = $2`, [request.params.periodId, userId])
  if (!period.rows[0]) throw new ApiError(404, 'BUDGET_PERIOD_NOT_FOUND', 'No se ha encontrado el periodo.')
  const transactions = await pool.query(`SELECT t.id, t.concept, t.amount_minor::text, pt.counted_minor::text, t.currency, t.occurred_at,
    coalesce((SELECT sum(ra.allocated_minor) FROM reward_allocations ra WHERE ra.period_id = $1 AND ra.transaction_id = t.id), 0)::text AS allocated_minor
    FROM budget_period_transactions pt JOIN financial_transactions t ON t.id = pt.transaction_id
    WHERE pt.period_id = $1 ORDER BY t.occurred_at, t.id`, [request.params.periodId])
  response.json({ data: { ...period.rows[0], transactions: transactions.rows.map((row) => ({ ...row,
    amountMinor: Number(row.amount_minor), countedMinor: Number(row.counted_minor), allocatedMinor: Number(row.allocated_minor),
    occurredAt: (row.occurred_at as Date).toISOString(), amount_minor: undefined, counted_minor: undefined, allocated_minor: undefined, occurred_at: undefined,
  })) }, meta: {} })
}))

function requireCron(request: Request, _response: Response, next: NextFunction) {
  const provided = request.header('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const expected = config.cronSecret
  const valid = provided.length === expected.length && expected.length >= 20 && timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  next(valid ? undefined : new ApiError(401, 'INVALID_CRON_SECRET', 'La credencial interna no es válida.'))
}

export const budgetInternalRouter = Router()
budgetInternalRouter.use(requireCron)
const closeDueHandler = asyncHandler(async (request, response) => {
  const results = await closeDueBudgetPeriods({ limit: 50, requestId: (request as AppRequest).requestId })
  response.json({ data: { evaluated: results.filter((item) => item.evaluated).length, results }, meta: {} })
})
budgetInternalRouter.get('/jobs/close-due-periods', closeDueHandler)
budgetInternalRouter.post('/jobs/close-due-periods', closeDueHandler)
budgetInternalRouter.post('/budget-periods/:periodId/evaluate', asyncHandler(async (request, response) => {
  const result = await evaluateBudgetPeriod(uuidParam(request, 'periodId'), { requestId: (request as AppRequest).requestId, force: request.body?.force === true })
  response.json({ data: result, meta: {} })
}))
