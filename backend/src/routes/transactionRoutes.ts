import { Router } from 'express'
import { z } from 'zod'
import { type AppRequest, requireAuth } from '../auth.js'
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
      SELECT count(*)::text AS count FROM financial_transactions
       WHERE category_id = $1 AND user_id = $2
    `, [categoryId, userId])
    const archived = Number(references.rows[0]?.count ?? 0) > 0
    if (archived) {
      await client.query('UPDATE categories SET is_archived = true WHERE id = $1 AND user_id = $2', [categoryId, userId])
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
  const values: unknown[] = [userId]
  const clauses = ['t.user_id = $1']
  const add = (sql: string, value: unknown) => { values.push(value); clauses.push(sql.replace('?', `$${values.length}`)) }
  if (filters.from) add('t.occurred_at >= ?', filters.from)
  if (filters.to) add('t.occurred_at < ?', filters.to)
  if (filters.type) add('t.type = ?::transaction_type', filters.type)
  if (filters.categoryId) add('t.category_id = ?', filters.categoryId)
  if (filters.status) add('t.status = ?::transaction_status', filters.status)
  if (filters.minAmount) add('t.amount_minor >= ?', filters.minAmount)
  if (filters.maxAmount) add('t.amount_minor <= ?', filters.maxAmount)
  if (filters.query) add("(t.concept ILIKE ? OR coalesce(c.name, '') ILIKE ?)", `%${filters.query}%`)

  if (filters.query) {
    const last = values.length
    clauses[clauses.length - 1] = `(t.concept ILIKE $${last} OR coalesce(c.name, '') ILIKE $${last})`
  }
  const where = clauses.join(' AND ')
  const count = await pool.query<{ total: string }>(`
    SELECT count(*)::text AS total FROM financial_transactions t
    LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id WHERE ${where}
  `, values)
  values.push(filters.pageSize, (filters.page - 1) * filters.pageSize)
  const rows = await pool.query(`
    SELECT t.*, c.name AS category_name FROM financial_transactions t
    LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
    WHERE ${where} ORDER BY t.occurred_at DESC, t.created_at DESC
    LIMIT $${values.length - 1} OFFSET $${values.length}
  `, values)
  const total = Number(count.rows[0]?.total ?? 0)
  response.json({ data: rows.rows.map((row) => transactionDto(row as Record<string, unknown>)), meta: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) } })
}))

transactionRouter.get('/dashboard', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  response.json({ data: await getDashboard(pool, userId), meta: { period: String(request.query.period ?? 'month') } })
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
    const current = await client.query<{ locked_by_reward: boolean }>('SELECT locked_by_reward FROM financial_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE', [transactionId, userId])
    if (!current.rows[0]) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'No se ha encontrado la operación.')
    if (current.rows[0].locked_by_reward) throw new ApiError(409, 'REWARDED_TRANSACTION_LOCKED', 'Esta operación pertenece a un cierre recompensado.')
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
    const current = await client.query<{ locked_by_reward: boolean }>('SELECT locked_by_reward FROM financial_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE', [transactionId, userId])
    if (!current.rows[0]) throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'No se ha encontrado la operación.')
    if (current.rows[0].locked_by_reward) throw new ApiError(409, 'REWARDED_TRANSACTION_LOCKED', 'Esta operación pertenece a un cierre recompensado.')
    await client.query('DELETE FROM financial_transactions WHERE id = $1 AND user_id = $2', [transactionId, userId])
    const body = { data: { dashboard: await getDashboard(client, userId) }, meta: {} }
    await storeResponse(client, userId, scope, key, 200, body)
    return { status: 200, body }
  })
  response.status(result.status).json(result.body)
}))
