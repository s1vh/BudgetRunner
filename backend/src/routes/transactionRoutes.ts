import { Router } from 'express'
import { z } from 'zod'
import { type AppRequest, requireAuth } from '../auth.js'
import { activateDueBudgets, closeDueBudgetPeriods } from '../budgetEngine.js'
import { getDashboard, transactionDto } from '../dashboard.js'
import { pool, type DbClient, withTransaction } from '../db.js'
import { ApiError, asyncHandler } from '../errors.js'
import { systemCategoryKey } from '../systemCategories.js'

const transactionSchema = z.object({
  type: z.enum(['expense', 'income']),
  concept: z.string().trim().min(2).max(160),
  amountMinor: z.number().int().positive().safe(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  categoryId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(['posted', 'scheduled']).default('posted'),
})

const adjustmentSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  occurredAt: z.string().datetime({ offset: true }),
})

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  icon: z.string().trim().regex(/^[a-z0-9-]{1,64}$/).default('shapes'),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).transform((value) => value.toUpperCase()).default('#986780'),
})

const categoryUpdateSchema = categorySchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: 'Debes indicar al menos un campo para actualizar.' },
)

interface CategoryRow {
  id: string
  name: string
  icon_key: string
  color_token: string
  is_system_seed: boolean
}

function categoryDto(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon_key,
    color: row.color_token,
    ...(systemCategoryKey(row.icon_key, row.is_system_seed) ? { systemKey: systemCategoryKey(row.icon_key, row.is_system_seed) } : {}),
  }
}

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  type: z.enum(['expense', 'income']).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['posted', 'scheduled', 'voided']).optional(),
  minAmount: z.coerce.number().int().positive().optional(),
  maxAmount: z.coerce.number().int().positive().optional(),
  query: z.string().trim().max(160).optional(),
})

function idempotencyKey(request: AppRequest) {
  const value = request.header('idempotency-key')
  const parsed = z.string().uuid().safeParse(value)
  if (!parsed.success) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'La cabecera Idempotency-Key debe contener un UUID.')
  return parsed.data
}

async function previousResponse(client: DbClient, userId: string, scope: string, key: string) {
  const result = await client.query<{ response_status: number; response_body: unknown }>(`
    SELECT response_status, response_body FROM idempotency_records
     WHERE user_id = $1 AND scope = $2 AND idempotency_key = $3
  `, [userId, scope, key])
  return result.rows[0]
}

async function storeResponse(client: DbClient, userId: string, scope: string, key: string, status: number, body: unknown) {
  await client.query(`
    INSERT INTO idempotency_records (user_id, scope, idempotency_key, response_status, response_body)
    VALUES ($1, $2, $3, $4, $5)
  `, [userId, scope, key, status, body])
}

async function assertCategory(client: DbClient, userId: string, categoryId: string) {
  const category = await client.query('SELECT 1 FROM categories WHERE id = $1 AND user_id = $2 AND is_archived = false', [categoryId, userId])
  if (!category.rowCount) throw new ApiError(400, 'INVALID_CATEGORY', 'La categoría indicada no existe.')
}

async function savedTransaction(client: DbClient, userId: string, transactionId: string) {
  const result = await client.query(`
    SELECT t.*, c.name AS category_name FROM financial_transactions t
    LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
    WHERE t.id = $1 AND t.user_id = $2
  `, [transactionId, userId])
  const row = result.rows[0]
  if (!row) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'No se ha encontrado la operación.')
  return transactionDto(row as Record<string, unknown>)
}

export const transactionRouter = Router()
transactionRouter.use(requireAuth)

transactionRouter.get('/categories', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const result = await pool.query<CategoryRow>(`
    SELECT id, name, icon_key, color_token, is_system_seed FROM categories
     WHERE user_id = $1 AND is_archived = false ORDER BY is_system_seed DESC, name
  `, [userId])
  response.json({ data: result.rows.map(categoryDto), meta: {} })
}))

transactionRouter.post('/categories', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const input = categorySchema.parse(request.body)
  const category = await withTransaction(async (client) => {
    const inserted = await client.query<CategoryRow>(`
      INSERT INTO categories (user_id, name, icon_key, color_token)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, icon_key, color_token, is_system_seed
    `, [userId, input.name, input.icon, input.color])
    const row = inserted.rows[0]
    if (!row) throw new Error('Category insert failed')
    await client.query(`
      INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'category.created', 'category', $2, $3, jsonb_build_object('name', $4::text))
    `, [userId, row.id, appRequest.requestId, row.name])
    return categoryDto(row)
  })
  response.status(201).json({ data: category, meta: {} })
}))

transactionRouter.patch('/categories/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const categoryId = z.string().uuid().parse(request.params.id)
  const input = categoryUpdateSchema.parse(request.body)
  const category = await withTransaction(async (client) => {
    const updated = await client.query<CategoryRow>(`
      UPDATE categories
         SET name = coalesce($3, name),
             icon_key = coalesce($4, icon_key),
             color_token = coalesce($5, color_token),
             is_system_seed = CASE WHEN $3 IS NOT NULL AND $3 IS DISTINCT FROM name THEN false ELSE is_system_seed END
       WHERE id = $1 AND user_id = $2 AND is_archived = false
       RETURNING id, name, icon_key, color_token, is_system_seed
    `, [categoryId, userId, input.name ?? null, input.icon ?? null, input.color ?? null])
    const row = updated.rows[0]
    if (!row) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'No se ha encontrado la categoría.')
    await client.query(`
      INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'category.updated', 'category', $2, $3, jsonb_build_object('name', $4::text))
    `, [userId, row.id, appRequest.requestId, row.name])
    return categoryDto(row)
  })
  response.json({ data: category, meta: {} })
}))

transactionRouter.delete('/categories/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const categoryId = z.string().uuid().parse(request.params.id)
  const result = await withTransaction(async (client) => {
    const current = await client.query<{ id: string; name: string }>(`
      SELECT id, name FROM categories
       WHERE id = $1 AND user_id = $2 AND is_archived = false
       FOR UPDATE
    `, [categoryId, userId])
    const category = current.rows[0]
    if (!category) throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'No se ha encontrado la categoría.')

    const references = await client.query<{ count: string }>(`
      SELECT (
        (SELECT count(*) FROM financial_transactions WHERE category_id = $1 AND user_id = $2)
        +
        (SELECT count(*) FROM budgets WHERE category_id = $1 AND user_id = $2)
        +
        (SELECT count(*) FROM budget_periods WHERE category_id_snapshot = $1 AND user_id = $2)
      )::text AS count
    `, [categoryId, userId])
    const archived = Number(references.rows[0]?.count ?? 0) > 0
    if (archived) {
      await client.query('UPDATE categories SET is_archived = true WHERE id = $1 AND user_id = $2', [categoryId, userId])
      // Category budgets keep their already committed period, but pausing the
      // template prevents an archived category from renewing forever.
      await client.query(`
        UPDATE budgets
           SET status = 'paused'
         WHERE category_id = $1
           AND user_id = $2
           AND status IN ('active', 'scheduled')
      `, [categoryId, userId])
    } else {
      await client.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [categoryId, userId])
    }
    await client.query(`
      INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'category.deleted', 'category', $2, $3,
        jsonb_build_object('name', $4::text, 'archived', $5::boolean))
    `, [userId, categoryId, appRequest.requestId, category.name, archived])
    return { id: categoryId, archived }
  })
  response.json({ data: result, meta: {} })
}))

transactionRouter.get('/transactions', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const filters = listSchema.parse(request.query)
  const values: unknown[] = [
    userId,
    filters.from ?? null,
    filters.to ?? null,
    filters.type ?? null,
    filters.categoryId ?? null,
    filters.status ?? null,
    filters.minAmount ?? null,
    filters.maxAmount ?? null,
    filters.query ? `%${filters.query}%` : null,
  ]
  const count = await pool.query<{ total: string }>(`
    SELECT count(*)::text AS total FROM financial_transactions t
    LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
    WHERE t.user_id = $1
      AND ($2::timestamptz IS NULL OR t.occurred_at >= $2)
      AND ($3::timestamptz IS NULL OR t.occurred_at < $3)
      AND ($4::transaction_type IS NULL OR t.type = $4)
      AND ($5::uuid IS NULL OR t.category_id = $5)
      AND ($6::transaction_status IS NULL OR t.status = $6)
      AND ($7::bigint IS NULL OR t.amount_minor >= $7)
      AND ($8::bigint IS NULL OR t.amount_minor <= $8)
      AND ($9::text IS NULL OR t.concept ILIKE $9 OR coalesce(c.name, '') ILIKE $9)
  `, values)
  values.push(filters.pageSize, (filters.page - 1) * filters.pageSize)
  const rows = await pool.query(`
    SELECT t.*, c.name AS category_name FROM financial_transactions t
    LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
    WHERE t.user_id = $1
      AND ($2::timestamptz IS NULL OR t.occurred_at >= $2)
      AND ($3::timestamptz IS NULL OR t.occurred_at < $3)
      AND ($4::transaction_type IS NULL OR t.type = $4)
      AND ($5::uuid IS NULL OR t.category_id = $5)
      AND ($6::transaction_status IS NULL OR t.status = $6)
      AND ($7::bigint IS NULL OR t.amount_minor >= $7)
      AND ($8::bigint IS NULL OR t.amount_minor <= $8)
      AND ($9::text IS NULL OR t.concept ILIKE $9 OR coalesce(c.name, '') ILIKE $9)
    ORDER BY t.occurred_at DESC, t.created_at DESC
    LIMIT $10 OFFSET $11
  `, values)
  const total = Number(count.rows[0]?.total ?? 0)
  response.json({ data: rows.rows.map((row) => transactionDto(row as Record<string, unknown>)), meta: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } })
}))

transactionRouter.get('/dashboard', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const period = z.enum(['month']).default('month').parse(request.query.period)
  await closeDueBudgetPeriods({ userId: appRequest.userId, limit: 100, requestId: appRequest.requestId })
  await activateDueBudgets(appRequest.userId)
  response.json({ data: await getDashboard(pool, appRequest.userId), meta: { period } })
}))

transactionRouter.post('/transactions', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const key = idempotencyKey(appRequest)
  const input = transactionSchema.parse(request.body)
  if (new Date(input.occurredAt).getTime() > Date.now() && input.status !== 'scheduled') {
    throw new ApiError(422, 'FUTURE_TRANSACTION_MUST_BE_SCHEDULED', 'Una operación futura debe marcarse como programada.')
  }

  const result = await withTransaction(async (client) => {
    const previous = await previousResponse(client, userId, 'transactions:create', key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    await assertCategory(client, userId, input.categoryId)
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO financial_transactions (user_id, category_id, type, status, concept, amount_minor, currency, occurred_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [userId, input.categoryId, input.type, input.status, input.concept, input.amountMinor, input.currency, input.occurredAt, input.notes ?? null])
    const id = inserted.rows[0]?.id
    if (!id) throw new Error('Transaction insert failed')
    const transaction = await savedTransaction(client, userId, id)
    const dashboard = await getDashboard(client, userId)
    const body = { data: { transaction, dashboard }, meta: {} }
    await client.query(`
      INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'transaction.created', 'financial_transaction', $2, $3, jsonb_build_object('type', $4::text))
    `, [userId, id, appRequest.requestId, input.type])
    await storeResponse(client, userId, 'transactions:create', key, 201, body)
    return { status: 201, body }
  })
  response.status(result.status).json(result.body)
}))

transactionRouter.post('/transactions/:id/adjustments', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const key = idempotencyKey(appRequest)
  const originalId = z.string().uuid().parse(request.params.id)
  const input = adjustmentSchema.parse(request.body)
  if (new Date(input.occurredAt).getTime() > Date.now()) {
    throw new ApiError(422, 'FUTURE_ADJUSTMENT_FORBIDDEN', 'Un ajuste compensatorio no puede tener una fecha futura.')
  }
  const scope = `transactions:adjust:${originalId}`
  const result = await withTransaction(async (client) => {
    const previous = await previousResponse(client, userId, scope, key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    const original = await client.query<{
      id: string
      type: 'expense' | 'income'
      concept: string
      amount_minor: string
      currency: string
      category_id: string
      locked_by_reward: boolean
    }>(`
      SELECT id, type::text, concept, amount_minor::text, currency, category_id, locked_by_reward
        FROM financial_transactions
       WHERE id = $1 AND user_id = $2
       FOR UPDATE
    `, [originalId, userId])
    const source = original.rows[0]
    if (!source) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'No se ha encontrado la operación.')
    // Recheck after acquiring the source lock. Updating the source below also
    // makes concurrent serializable retries restart and observe this record.
    const replayAfterLock = await previousResponse(client, userId, scope, key)
    if (replayAfterLock) return { status: replayAfterLock.response_status, body: replayAfterLock.response_body }
    if (!source.locked_by_reward) {
      throw new ApiError(409, 'TRANSACTION_NOT_REWARD_PROTECTED', 'La operación se puede corregir con la edición normal.')
    }
    const existing = await client.query('SELECT 1 FROM financial_transactions WHERE adjusts_transaction_id = $1', [originalId])
    if (existing.rowCount) {
      throw new ApiError(409, 'TRANSACTION_ALREADY_ADJUSTED', 'La operación ya tiene un ajuste compensatorio.')
    }
    const concept = `↺ ${source.concept}`.slice(0, 160)
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO financial_transactions
        (user_id, category_id, type, status, concept, amount_minor, currency, occurred_at,
         notes, adjusts_transaction_id, adjustment_reason)
      VALUES ($1, $2, $3, 'posted', $4, $5, $6, $7, $8::text, $9, $8::varchar(500))
      RETURNING id
    `, [
      userId,
      source.category_id,
      source.type === 'expense' ? 'income' : 'expense',
      concept,
      source.amount_minor,
      source.currency,
      input.occurredAt,
      input.reason,
      originalId,
    ])
    const adjustmentId = inserted.rows[0]?.id
    if (!adjustmentId) throw new Error('Compensating adjustment insert failed')
    await client.query('UPDATE financial_transactions SET updated_at = now() WHERE id = $1 AND user_id = $2', [originalId, userId])
    const transaction = await savedTransaction(client, userId, adjustmentId)
    const dashboard = await getDashboard(client, userId)
    const body = { data: { transaction, dashboard }, meta: {} }
    await client.query(`
      INSERT INTO audit_events
        (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'transaction.adjusted', 'financial_transaction', $2, $3,
        jsonb_build_object('originalTransactionId', $4::uuid))
    `, [userId, adjustmentId, appRequest.requestId, originalId])
    await storeResponse(client, userId, scope, key, 201, body)
    return { status: 201, body }
  })
  response.status(result.status).json(result.body)
}))

transactionRouter.patch('/transactions/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const key = idempotencyKey(appRequest)
  const input = transactionSchema.parse(request.body)
  const transactionId = z.string().uuid().parse(request.params.id)
  const scope = `transactions:update:${transactionId}`
  const result = await withTransaction(async (client) => {
    const previous = await previousResponse(client, userId, scope, key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    const current = await client.query<{ locked_by_reward: boolean; adjusts_transaction_id: string | null }>(
      'SELECT locked_by_reward, adjusts_transaction_id FROM financial_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [transactionId, userId],
    )
    if (!current.rows[0]) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'No se ha encontrado la operación.')
    if (current.rows[0].locked_by_reward) throw new ApiError(409, 'REWARDED_TRANSACTION_LOCKED', 'Esta operación pertenece a un cierre recompensado.')
    if (current.rows[0].adjusts_transaction_id) throw new ApiError(409, 'ADJUSTMENT_TRANSACTION_LOCKED', 'Un ajuste compensatorio no se puede editar.')
    await assertCategory(client, userId, input.categoryId)
    await client.query(`
      UPDATE financial_transactions SET category_id = $3, type = $4, status = $5, concept = $6,
        amount_minor = $7, currency = $8, occurred_at = $9, notes = $10
      WHERE id = $1 AND user_id = $2
    `, [transactionId, userId, input.categoryId, input.type, input.status, input.concept, input.amountMinor, input.currency, input.occurredAt, input.notes ?? null])
    const body = { data: { transaction: await savedTransaction(client, userId, transactionId), dashboard: await getDashboard(client, userId) }, meta: {} }
    await storeResponse(client, userId, scope, key, 200, body)
    return { status: 200, body }
  })
  response.status(result.status).json(result.body)
}))

transactionRouter.delete('/transactions/:id', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const key = idempotencyKey(appRequest)
  const transactionId = z.string().uuid().parse(request.params.id)
  const scope = `transactions:delete:${transactionId}`
  const result = await withTransaction(async (client) => {
    const previous = await previousResponse(client, userId, scope, key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    const current = await client.query<{ locked_by_reward: boolean; adjusts_transaction_id: string | null }>(
      'SELECT locked_by_reward, adjusts_transaction_id FROM financial_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [transactionId, userId],
    )
    if (!current.rows[0]) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'No se ha encontrado la operación.')
    if (current.rows[0].locked_by_reward) throw new ApiError(409, 'REWARDED_TRANSACTION_LOCKED', 'Esta operación pertenece a un cierre recompensado.')
    if (current.rows[0].adjusts_transaction_id) throw new ApiError(409, 'ADJUSTMENT_TRANSACTION_LOCKED', 'Un ajuste compensatorio no se puede eliminar.')
    await client.query('DELETE FROM financial_transactions WHERE id = $1 AND user_id = $2', [transactionId, userId])
    const body = { data: { dashboard: await getDashboard(client, userId) }, meta: {} }
    await storeResponse(client, userId, scope, key, 200, body)
    return { status: 200, body }
  })
  response.status(result.status).json(result.body)
}))
