import { randomUUID } from 'node:crypto'
import type { DecodedIdToken } from 'firebase-admin/auth'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import {
  createBudgetPeriod,
  evaluateBudgetPeriod,
  evaluateDueBudgetPeriod,
  type BudgetTemplateRow,
} from '../src/budgetEngine.js'
import { closeDatabase, pool, withTransaction } from '../src/db.js'
import { errorHandler } from '../src/errors.js'
import { findOrCreateFirebaseUser } from '../src/firebaseAuth.js'
import { findOrCreateGoogleUser } from '../src/googleOAuth.js'
import { createBudgetInternalRouter } from '../src/routes/budgetRoutes.js'

const app = createApp()
const internalJobSecret = 'integration-cron-secret-2026'
const internalJobApp = express()
internalJobApp.use('/api/v1/internal', createBudgetInternalRouter(internalJobSecret))
internalJobApp.use(errorHandler)
const password = 'TestRunner!2026'
const primaryEmail = `api-${randomUUID()}@budgetrunner.local`
const secondaryEmail = `isolation-${randomUUID()}@budgetrunner.local`
const googleOnlyEmail = `google-${randomUUID()}@budgetrunner.local`
let token = ''
let secondaryToken = ''
let userId = ''
let secondaryUserId = ''
let categoryId = ''
let offerId = ''
let damagedModuleId = ''
let rewardedExpenseId = ''

async function register(email: string, displayName: string) {
  const response = await request(app).post('/api/v1/auth/register').send({
    email, password, displayName, currency: 'EUR', timezone: 'Europe/Madrid',
  })
  expect(response.status).toBe(201)
  return response.body.data as { accessToken: string; user: { id: string } }
}

beforeAll(async () => {
  const primary = await register(primaryEmail, 'API Runner')
  const secondary = await register(secondaryEmail, 'Isolation Runner')
  token = primary.accessToken
  secondaryToken = secondary.accessToken
  userId = primary.user.id
  secondaryUserId = secondary.user.id
  const categories = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${token}`)
  categoryId = categories.body.data[0].id

  await pool.query('UPDATE user_progress SET synthcoin_balance = 2500 WHERE user_id = $1', [userId])
  const rotation = await pool.query<{ id: string }>(`
    INSERT INTO store_rotations (user_id, starts_at, ends_at, seed, user_level_snapshot, status)
    VALUES ($1, now(), now() + interval '1 day', $2, 10, 'active') RETURNING id
  `, [userId, `integration-${randomUUID()}`])
  const offer = await pool.query<{ id: string }>(`
    INSERT INTO store_offers (rotation_id, module_definition_id, price_snapshot, min_level_snapshot, expires_at)
    SELECT $1, id, price_coins, 1, now() + interval '1 day'
      FROM module_definitions WHERE sku = 'CPU-NEURAL-FORGE' RETURNING id
  `, [rotation.rows[0]?.id])
  offerId = offer.rows[0]?.id ?? ''
  const damaged = await pool.query<{ id: string }>(`
    INSERT INTO user_module_instances (user_id, definition_id, slot, original_price_coins, power_snapshot, shield_snapshot, energy, state)
    SELECT $1, id, slot, price_coins, power, shield, 72, 'equipped'
      FROM module_definitions WHERE sku = 'COOLING-CRYO' RETURNING id
  `, [userId])
  damagedModuleId = damaged.rows[0]?.id ?? ''
})

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email IN ($1, $2, $3)', [primaryEmail, secondaryEmail, googleOnlyEmail])
  await closeDatabase()
})

describe.sequential('Budget Runner API', () => {
  test('protege las rutas privadas', async () => {
    const response = await request(app).get('/api/v1/transactions')
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED')
  })

  test('interrumpe entradas con forma de consulta sin revelar la barrera ni modificar datos', async () => {
    const before = await pool.query<{ categories: string; transactions: string }>(`
      SELECT
        (SELECT count(*)::text FROM categories WHERE user_id = $1) AS categories,
        (SELECT count(*)::text FROM financial_transactions WHERE user_id = $1) AS transactions
    `, [userId])
    const attempts = [
      request(app).post('/api/v1/auth/login').send({ email: "nomada@budgetrunner.local' OR 1=1--", password }),
      request(app).post('/api/v1/categories').set('Authorization', `Bearer ${token}`)
        .send({ name: 'UN/**/ION/**/SEL/**/ECT password_hash FROM users', icon: 'shapes', color: '#986780' }),
      request(app).post('/api/v1/transactions').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
        .send({
          type: 'expense', concept: '%53%45%4c%45%43%54 * %46%52%4f%4d users', amountMinor: 100,
          currency: 'EUR', categoryId, occurredAt: new Date().toISOString(), notes: "x'); DROP TABLE users;--",
        }),
      request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`)
        .query({ query: 'WITH stolen AS (SELECT * FROM users) SELECT * FROM stolen' }),
    ]

    for (const attempt of attempts) {
      const response = await attempt
      expect(response.status).toBe(422)
      expect(response.body.error).toMatchObject({
        code: 'TRANSMISSION_REJECTED',
        message: 'La transmisión no se ha podido sincronizar.',
        details: {},
      })
      expect(response.body.error.message).not.toMatch(/sql|inyec|query|consulta|filtro/iu)
      expect(response.headers['clear-site-data']).toBe('"cache"')
      expect(response.headers['cache-control']).toBe('no-store')
    }

    const after = await pool.query<{ categories: string; transactions: string }>(`
      SELECT
        (SELECT count(*)::text FROM categories WHERE user_id = $1) AS categories,
        (SELECT count(*)::text FROM financial_transactions WHERE user_id = $1) AS transactions
    `, [userId])
    expect(after.rows[0]).toEqual(before.rows[0])
  })

  test('admite apóstrofes y palabras parecidas que no forman una consulta', async () => {
    const created = await request(app).post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: "O'Brien Selecta Café", icon: 'shapes', color: '#12ABEF' })
    expect(created.status).toBe(201)
    const occurredAt = new Date()
    const transaction = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: "Compra en O'Brien Selecta", amountMinor: 175, currency: 'EUR',
        categoryId: created.body.data.id, occurredAt: occurredAt.toISOString(), notes: 'Cena con Ana -- viernes',
      })
    expect(transaction.status).toBe(201)
    const filtered = await request(app).get('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`)
      .query({
        from: new Date(occurredAt.getTime() - 60_000).toISOString(),
        to: new Date(occurredAt.getTime() + 60_000).toISOString(),
        type: 'expense', categoryId: created.body.data.id, status: 'posted', minAmount: 100, maxAmount: 200,
        query: "O'Brien",
      })
    expect(filtered.status).toBe(200)
    expect(filtered.body.data.map((item: { id: string }) => item.id)).toContain(transaction.body.data.transaction.id)
    await request(app).delete(`/api/v1/transactions/${transaction.body.data.transaction.id}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
    const removed = await request(app).delete(`/api/v1/categories/${created.body.data.id}`).set('Authorization', `Bearer ${token}`)
    expect(removed.status).toBe(200)
  })

  test('persiste el idioma del perfil y expone categorías del sistema traducibles', async () => {
    const categories = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${token}`)
    expect(categories.status).toBe(200)
    expect(categories.body.data).toHaveLength(9)
    expect(categories.body.data.every((category: { systemKey?: string }) => Boolean(category.systemKey))).toBe(true)

    const updated = await request(app).patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'ko-KR' })
    expect(updated.status).toBe(200)
    expect(updated.body.data.locale).toBe('ko-KR')

    const profile = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`)
    expect(profile.body.data.locale).toBe('ko-KR')

    await request(app).patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'en-US' })
  })

  test('activa la ayuda por defecto y completa el tour una sola vez', async () => {
    const initial = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`)
    expect(initial.status).toBe(200)
    expect(initial.body.data.preferences.helpHints).toBe(true)
    expect(initial.body.data.preferences.customCursor).toBe(true)
    expect(initial.body.data.guidedTourCompleted).toBe(false)

    const disabledCursor = await request(app).patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: { ...initial.body.data.preferences, customCursor: false } })
    expect(disabledCursor.status).toBe(200)
    expect(disabledCursor.body.data.preferences.customCursor).toBe(false)

    const restoredCursor = await request(app).patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ preferences: { ...initial.body.data.preferences, customCursor: true } })
    expect(restoredCursor.status).toBe(200)
    expect(restoredCursor.body.data.preferences.customCursor).toBe(true)

    const first = await request(app).post('/api/v1/me/guided-tour/complete').set('Authorization', `Bearer ${token}`)
    const replay = await request(app).post('/api/v1/me/guided-tour/complete').set('Authorization', `Bearer ${token}`)
    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    expect(first.body.data.guidedTourCompleted).toBe(true)

    const completedAt = await pool.query<{ guided_tour_completed_at: Date }>(
      'SELECT guided_tour_completed_at FROM users WHERE id = $1', [userId],
    )
    expect(completedAt.rows[0]?.guided_tour_completed_at).toBeInstanceOf(Date)
    const profile = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${token}`)
    expect(profile.body.data.guidedTourCompleted).toBe(true)
  })

  test('vincula Google por email verificado y aprovisiona una cuenta nueva sin duplicados', async () => {
    const linkedSubject = `google-linked-${randomUUID()}`
    const linkedUserId = await withTransaction((client) => findOrCreateGoogleUser(client, {
      subject: linkedSubject,
      email: primaryEmail,
      displayName: 'API Runner desde Google',
      avatarUrl: 'https://lh3.googleusercontent.com/a/test-avatar',
    }))
    expect(linkedUserId).toBe(userId)
    const repeatedUserId = await withTransaction((client) => findOrCreateGoogleUser(client, {
      subject: linkedSubject,
      email: primaryEmail,
      displayName: 'API Runner desde Google',
    }))
    expect(repeatedUserId).toBe(userId)
    const linkedCount = await pool.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM oauth_accounts WHERE provider = 'google' AND provider_subject = $1
    `, [linkedSubject])
    expect(Number(linkedCount.rows[0]?.count)).toBe(1)

    const googleUserId = await withTransaction((client) => findOrCreateGoogleUser(client, {
      subject: `google-new-${randomUUID()}`,
      email: googleOnlyEmail,
      displayName: 'Google Runner',
    }))
    const provisioned = await pool.query<{ password_hash: string | null; categories: string; progress: boolean }>(`
      SELECT u.password_hash,
        (SELECT count(*)::text FROM categories c WHERE c.user_id = u.id) AS categories,
        EXISTS (SELECT 1 FROM user_progress p WHERE p.user_id = u.id) AS progress
      FROM users u WHERE u.id = $1
    `, [googleUserId])
    expect(provisioned.rows[0]).toMatchObject({ password_hash: null, categories: '9', progress: true })
  })

  test('vincula una identidad Firebase verificada al UUID interno sin duplicar el usuario', async () => {
    const firebaseUid = `firebase-${randomUUID()}`
    const identity = {
      uid: firebaseUid,
      sub: firebaseUid,
      email: primaryEmail,
      email_verified: true,
      name: 'API Runner Firebase',
      firebase: { identities: { email: [primaryEmail] }, sign_in_provider: 'google.com' },
    } as unknown as DecodedIdToken
    const first = await withTransaction((client) => findOrCreateFirebaseUser(client, identity))
    const replay = await withTransaction((client) => findOrCreateFirebaseUser(client, identity))
    expect(first).toBe(userId)
    expect(replay).toBe(userId)
    const count = await pool.query<{ count: string; firebase_uid: string }>(`
      SELECT (SELECT count(*)::text FROM users WHERE email = $1) AS count, firebase_uid
      FROM users WHERE id = $2
    `, [primaryEmail, userId])
    expect(count.rows[0]).toMatchObject({ count: '1', firebase_uid: firebaseUid })
  })

  test('crea, edita y archiva categorías usadas sin romper el historial', async () => {
    const created = await request(app).post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viajes estelares', icon: 'car', color: '#12ABEF' })
    expect(created.status).toBe(201)
    expect(created.body.data.name).toBe('Viajes estelares')
    const id = created.body.data.id as string

    const isolated = await request(app).patch(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${secondaryToken}`)
      .send({ name: 'Categoría ajena' })
    expect(isolated.status).toBe(404)

    const updated = await request(app).patch(`/api/v1/categories/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viajes hiperespaciales', icon: 'car', color: '#FF007F' })
    expect(updated.status).toBe(200)
    expect(updated.body.data).toMatchObject({ name: 'Viajes hiperespaciales', color: '#FF007F' })

    const transaction = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Salto de prueba', amountMinor: 321, currency: 'EUR', categoryId: id,
        occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(transaction.status).toBe(201)

    const removed = await request(app).delete(`/api/v1/categories/${id}`).set('Authorization', `Bearer ${token}`)
    expect(removed.status).toBe(200)
    expect(removed.body.data.archived).toBe(true)

    const active = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${token}`)
    expect(active.body.data.some((category: { id: string }) => category.id === id)).toBe(false)
    const history = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${token}`)
    expect(history.body.data.find((item: { id: string }) => item.id === transaction.body.data.transaction.id)?.categoryName)
      .toBe('Viajes hiperespaciales')

    await request(app).delete(`/api/v1/transactions/${transaction.body.data.transaction.id}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
  })

  test('crea un gasto una sola vez y actualiza el dashboard', async () => {
    const key = randomUUID()
    const input = {
      type: 'expense', concept: 'Transacción idempotente', amountMinor: 1234, currency: 'EUR', categoryId,
      occurredAt: new Date().toISOString(), status: 'posted',
    }
    const first = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(input)
    const replay = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key).send(input)
    expect(first.status).toBe(201)
    expect(replay.status).toBe(201)
    expect(replay.body.data.transaction.id).toBe(first.body.data.transaction.id)
    expect(first.body.data.dashboard.balanceMinor).toBe(-1234)

    const list = await request(app).get('/api/v1/transactions').set('Authorization', `Bearer ${secondaryToken}`)
    expect(list.body.data.some((item: { id: string }) => item.id === first.body.data.transaction.id)).toBe(false)

    await request(app).delete(`/api/v1/transactions/${first.body.data.transaction.id}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
  })

  test('compra una mejora atómicamente e impide el doble cargo', async () => {
    const key = randomUUID()
    const first = await request(app).post(`/api/v1/game/store/offers/${offerId}/purchase`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key)
    const replay = await request(app).post(`/api/v1/game/store/offers/${offerId}/purchase`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key)
    expect(first.status).toBe(200)
    expect(first.body.data.netCost).toBe(800)
    expect(first.body.data.balanceAfter).toBe(1700)
    expect(replay.body.data.balanceAfter).toBe(1700)
    const events = await pool.query<{ count: string }>('SELECT count(*)::text AS count FROM module_purchase_events WHERE user_id = $1', [userId])
    expect(Number(events.rows[0]?.count)).toBe(1)
  })

  test('repara con coste redondeado por el servidor', async () => {
    const response = await request(app).post(`/api/v1/game/modules/${damagedModuleId}/repair`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
    expect(response.status).toBe(200)
    expect(response.body.data.repairCost).toBe(110)
    expect(response.body.data.balanceAfter).toBe(1590)
    const module = await pool.query<{ energy: number }>('SELECT energy FROM user_module_instances WHERE id = $1', [damagedModuleId])
    expect(module.rows[0]?.energy).toBe(100)
  })

  test('expone diez slots y proyección de progreso coherente', async () => {
    const [deck, summary] = await Promise.all([
      request(app).get('/api/v1/game/cyberdeck').set('Authorization', `Bearer ${token}`),
      request(app).get('/api/v1/game/summary').set('Authorization', `Bearer ${token}`),
    ])
    expect(deck.body.data).toHaveLength(10)
    expect(summary.body.data.totalFlux).toBe(summary.body.data.baseFlux + summary.body.data.activePower + summary.body.data.familyBonusPower)
  })

  test('rechaza zonas horarias no IANA antes de crear la cuenta', async () => {
    const email = `invalid-zone-${randomUUID()}@budgetrunner.local`
    const response = await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      displayName: 'Invalid Zone Runner',
      currency: 'EUR',
      timezone: 'Mars/Olympus_Mons',
    })
    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('INVALID_TIMEZONE')
    const persisted = await pool.query('SELECT 1 FROM users WHERE email = $1', [email])
    expect(persisted.rowCount).toBe(0)
  })

  test('persiste presupuestos, conserva snapshots y ofrece un único ajuste compensatorio', async () => {
    const dates = await pool.query<{ today: string; yesterday: string }>(`
      SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today,
             ((now() AT TIME ZONE 'Europe/Madrid')::date - 1)::text AS yesterday
    `)
    const today = dates.rows[0]?.today ?? ''
    const yesterday = dates.rows[0]?.yesterday ?? ''
    const draft = {
      name: 'Ciclo integrado', frequency: 'monthly', scope: 'global', limitMinor: 5000,
      currency: 'EUR', startsOn: today,
    }
    const rejectedPast = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({ ...draft, name: 'Ciclo histórico abusivo', startsOn: yesterday })
    expect(rejectedPast.status).toBe(422)
    expect(rejectedPast.body.error.code).toBe('BUDGET_START_IN_PAST')

    const createKey = randomUUID()
    const created = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', createKey).send(draft)
    const replay = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', createKey).send(draft)
    expect(created.status).toBe(201)
    expect(replay.status).toBe(201)
    expect(replay.body.data.id).toBe(created.body.data.id)
    const budgetId = created.body.data.id as string
    const periodId = created.body.data.periodId as string

    const isolated = await request(app).get(`/api/v1/budgets/${budgetId}`).set('Authorization', `Bearer ${secondaryToken}`)
    expect(isolated.status).toBe(404)

    const expense = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Gasto del cierre trazable', amountMinor: 1000, currency: 'EUR', categoryId,
        occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(expense.status).toBe(201)
    const expenseId = expense.body.data.transaction.id as string
    rewardedExpenseId = expenseId

    const patched = await request(app).patch(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Ciclo integrado actualizado', frequency: 'weekly', scope: 'category', categoryId,
        limitMinor: 2000, currency: 'USD',
      })
    expect(patched.status).toBe(200)
    expect(patched.body.data).toMatchObject({
      frequency: 'monthly', scope: 'global', limitMinor: 5000, currency: 'EUR',
      spendMinor: 1000, eligibleSurplusMinor: 1000, excludedRewardMinor: 3000,
      configuredFrequency: 'weekly', configuredScope: 'category', configuredCategoryId: categoryId,
      configuredLimitMinor: 2000, configuredCurrency: 'USD',
    })

    const progressBefore = await pool.query<{ synthcoin_balance: string; base_flux: number }>(
      'SELECT synthcoin_balance::text, base_flux FROM user_progress WHERE user_id = $1', [userId],
    )
    const firstClose = await evaluateBudgetPeriod(periodId, { force: true })
    const replayClose = await evaluateBudgetPeriod(periodId, { force: true })
    expect(firstClose).toMatchObject({ status: 'met', evaluated: true })
    expect(replayClose).toMatchObject({ status: 'met', evaluated: false })

    const periods = await request(app).get(`/api/v1/budgets/${budgetId}/periods`).set('Authorization', `Bearer ${token}`)
    const closed = periods.body.data.find((period: { id: string }) => period.id === periodId)
    expect(closed).toMatchObject({
      status: 'met', frequency: 'monthly', scope: 'global', limitMinor: 5000,
      currency: 'EUR', spendMinor: 1000, surplusMinor: 4000, eligibleSurplusMinor: 1000,
      excludedRewardMinor: 3000, synthcoinsAwarded: 10, fluxAwarded: 100,
    })
    const current = periods.body.data.find((period: { status: string }) => period.status === 'open')
    expect(current).toMatchObject({ frequency: 'weekly', scope: 'category', categoryId, limitMinor: 2000, currency: 'USD' })
    const progressAfter = await pool.query<{ synthcoin_balance: string; base_flux: number }>(
      'SELECT synthcoin_balance::text, base_flux FROM user_progress WHERE user_id = $1', [userId],
    )
    expect(Number(progressAfter.rows[0]?.synthcoin_balance) - Number(progressBefore.rows[0]?.synthcoin_balance)).toBe(10)
    expect((progressAfter.rows[0]?.base_flux ?? 0) - (progressBefore.rows[0]?.base_flux ?? 0)).toBe(100)

    const blockedEdit = await request(app).patch(`/api/v1/transactions/${expenseId}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Intento de reescritura', amountMinor: 900, currency: 'EUR', categoryId,
        occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(blockedEdit.status).toBe(409)
    expect(blockedEdit.body.error.code).toBe('REWARDED_TRANSACTION_LOCKED')

    const adjustmentKey = randomUUID()
    const adjustmentInput = { reason: 'Corrección contable validada', occurredAt: new Date().toISOString() }
    const [adjustment, adjustmentReplay] = await Promise.all([
      request(app).post(`/api/v1/transactions/${expenseId}/adjustments`)
        .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', adjustmentKey).send(adjustmentInput),
      request(app).post(`/api/v1/transactions/${expenseId}/adjustments`)
        .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', adjustmentKey).send(adjustmentInput),
    ])
    expect(adjustment.status).toBe(201)
    expect(adjustmentReplay.status).toBe(201)
    expect(adjustmentReplay.body.data.transaction.id).toBe(adjustment.body.data.transaction.id)
    expect(adjustment.body.data.transaction).toMatchObject({
      type: 'income', amountMinor: 1000, adjustsTransactionId: expenseId,
      adjustmentReason: adjustmentInput.reason,
    })
    expect(adjustment.body.data.dashboard.balanceMinor).toBe(0)
    const duplicateAdjustment = await request(app).post(`/api/v1/transactions/${expenseId}/adjustments`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID()).send(adjustmentInput)
    expect(duplicateAdjustment.status).toBe(409)
    expect(duplicateAdjustment.body.error.code).toBe('TRANSACTION_ALREADY_ADJUSTED')

    const archived = await request(app).delete(`/api/v1/budgets/${budgetId}`).set('Authorization', `Bearer ${token}`)
    expect(archived.status).toBe(204)
    const committed = await pool.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM budget_periods
       WHERE budget_id = $1 AND status = 'open'
    `, [budgetId])
    expect(Number(committed.rows[0]?.count)).toBe(1)
  })

  test('materializa límites locales reales a través de DST y recupera el ancla mensual', async () => {
    const bounds = await withTransaction(async (client) => {
      const inserted = await client.query<BudgetTemplateRow>(`
        INSERT INTO budgets
          (user_id, name, frequency, scope, category_id, limit_minor, currency, status, starts_on, timezone_snapshot)
        VALUES
          ($1, 'DST integration', 'weekly', 'global', NULL, 1000, 'EUR', 'scheduled', '2027-03-24', 'Europe/Madrid'),
          ($1, 'Month-end integration', 'monthly', 'global', NULL, 1000, 'EUR', 'scheduled', '2027-01-31', 'Europe/Madrid')
        RETURNING id, user_id, frequency::text, scope::text, category_id, status::text,
                  limit_minor::text, currency, starts_on::text, timezone_snapshot
      `, [userId])
      const dstBudget = inserted.rows.find((budget) => budget.frequency === 'weekly')
      const monthlyBudget = inserted.rows.find((budget) => budget.frequency === 'monthly')
      if (!dstBudget || !monthlyBudget) throw new Error('Calendar integration setup failed')
      const dst = await createBudgetPeriod(client, dstBudget, '2027-03-24')
      const january = await createBudgetPeriod(client, monthlyBudget, '2027-01-31')
      const february = await createBudgetPeriod(client, monthlyBudget, '2027-02-28')
      const local = await client.query<{ dst_start: string; dst_end: string; jan_end: string; feb_end: string }>(`
        SELECT to_char($1::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') AS dst_start,
               to_char($2::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') AS dst_end,
               to_char($3::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') AS jan_end,
               to_char($4::timestamptz AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD HH24:MI') AS feb_end
      `, [dst.startsAt, dst.endsAt, january.endsAt, february.endsAt])
      await client.query('DELETE FROM budgets WHERE id = ANY($1::uuid[])', [[dstBudget.id, monthlyBudget.id]])
      return { dst, local: local.rows[0] }
    })
    expect((bounds.dst.endsAt.getTime() - bounds.dst.startsAt.getTime()) / 3_600_000).toBe(167)
    expect(bounds.local).toMatchObject({
      dst_start: '2027-03-24 00:00',
      dst_end: '2027-03-31 00:00',
      jan_end: '2027-02-28 00:00',
      feb_end: '2027-03-31 00:00',
    })
  })

  test('mantiene escrituras compatibles con el backend anterior durante migrate y rollback', async () => {
    const budget = await pool.query<{ id: string }>(`
      INSERT INTO budgets
        (user_id, name, frequency, scope, category_id, limit_minor, currency, status, starts_on, timezone_snapshot)
      VALUES ($1, 'Legacy writer compatibility', 'weekly', 'global', NULL, 1000, 'USD', 'active', current_date, 'Europe/Madrid')
      RETURNING id
    `, [userId])
    const period = await pool.query<{ id: string; frequency_snapshot: string; scope_snapshot: string }>(`
      INSERT INTO budget_periods
        (budget_id, user_id, starts_at, ends_at, timezone_snapshot, status, limit_minor_snapshot, currency_snapshot)
      VALUES ($1, $2, now() - interval '1 hour', now() + interval '1 hour', 'Europe/Madrid', 'open', 1000, 'USD')
      RETURNING id, frequency_snapshot::text, scope_snapshot::text
    `, [budget.rows[0]?.id, userId])
    expect(period.rows[0]).toMatchObject({ frequency_snapshot: 'weekly', scope_snapshot: 'global' })
    const transaction = await pool.query<{ id: string }>(`
      INSERT INTO financial_transactions
        (user_id, category_id, type, status, concept, amount_minor, currency, occurred_at)
      VALUES ($1, $2, 'expense', 'posted', 'Legacy snapshot source', 321, 'USD', now())
      RETURNING id
    `, [userId, categoryId])
    const snapshot = await pool.query<{
      user_id: string
      source_transaction_id: string
      concept_snapshot: string
      amount_minor_snapshot: string
    }>(`
      INSERT INTO budget_period_transactions (period_id, transaction_id, counted_minor)
      VALUES ($1, $2, 321)
      RETURNING user_id, source_transaction_id, concept_snapshot, amount_minor_snapshot::text
    `, [period.rows[0]?.id, transaction.rows[0]?.id])
    expect(snapshot.rows[0]).toMatchObject({
      user_id: userId,
      source_transaction_id: transaction.rows[0]?.id,
      concept_snapshot: 'Legacy snapshot source',
      amount_minor_snapshot: '321',
    })

    const module = await pool.query<{ id: string }>(`
      INSERT INTO user_module_instances
        (user_id, definition_id, slot, original_price_coins, power_snapshot, shield_snapshot, energy, state, replaced_at)
      SELECT $1, id, slot, price_coins, power, shield, 90, 'replaced', now()
        FROM module_definitions WHERE sku = 'GPU-PIXEL-DRIFT'
      RETURNING id
    `, [userId])
    const damage = await pool.query<{ id: string }>(`
      INSERT INTO damage_events (user_id, base_damage, idempotency_key)
      VALUES ($1, 10, $2) RETURNING id
    `, [userId, randomUUID()])
    const detail = await pool.query<{ user_id: string }>(`
      INSERT INTO module_damage_events
        (damage_event_id, module_instance_id, shield_snapshot, energy_before, damage_applied, energy_after, destroyed)
      VALUES ($1, $2, 2, 100, 10, 90, false)
      RETURNING user_id
    `, [damage.rows[0]?.id, module.rows[0]?.id])
    expect(detail.rows[0]?.user_id).toBe(userId)

    await pool.query('DELETE FROM budgets WHERE id = $1', [budget.rows[0]?.id])
    await pool.query('DELETE FROM financial_transactions WHERE id = $1', [transaction.rows[0]?.id])
    await pool.query('DELETE FROM damage_events WHERE id = $1', [damage.rows[0]?.id])
    await pool.query('DELETE FROM user_module_instances WHERE id = $1', [module.rows[0]?.id])
  })

  test('redondea y limita recompensas a gasto trazable, incluso con gasto cero o solapado', async () => {
    const date = await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )
    const today = date.rows[0]?.today
    const balanceBefore = await pool.query<{ synthcoin_balance: string }>(
      'SELECT synthcoin_balance::text FROM user_progress WHERE user_id = $1', [userId],
    )

    const overlap = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Solapamiento trazable', frequency: 'monthly', scope: 'global', limitMinor: 2000,
        currency: 'EUR', startsOn: today,
      })
    expect(overlap.status).toBe(201)
    const overlapPeriodId = overlap.body.data.periodId as string
    await evaluateBudgetPeriod(overlapPeriodId, { force: true })
    const overlapDetail = await request(app).get(`/api/v1/budget-periods/${overlapPeriodId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(overlapDetail.body.data).toMatchObject({
      spendMinor: 1000, surplusMinor: 1000, eligibleSurplusMinor: 0,
      excludedRewardMinor: 1000, synthcoinsAwarded: 0,
    })
    expect(overlapDetail.body.data.transactions[0]).toMatchObject({ id: rewardedExpenseId, allocatedMinor: 0 })

    const empty = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Periodo sin gasto', frequency: 'monthly', scope: 'global', limitMinor: 1000,
        currency: 'GBP', startsOn: today,
      })
    expect(empty.status).toBe(201)
    const emptyPeriodId = empty.body.data.periodId as string
    await evaluateBudgetPeriod(emptyPeriodId, { force: true })
    const emptyDetail = await request(app).get(`/api/v1/budget-periods/${emptyPeriodId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(emptyDetail.body.data).toMatchObject({
      spendMinor: 0, surplusMinor: 1000, eligibleSurplusMinor: 0,
      excludedRewardMinor: 1000, synthcoinsAwarded: 0,
    })
    expect(emptyDetail.body.data.transactions).toEqual([])

    const lowExpense = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Capacidad trazable 150', amountMinor: 150, currency: 'CHF', categoryId,
        occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(lowExpense.status).toBe(201)
    const low = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Redondeo capacidad 150', frequency: 'monthly', scope: 'global', limitMinor: 1000,
        currency: 'CHF', startsOn: today,
      })
    expect(low.status).toBe(201)
    expect(low.body.data).toMatchObject({
      spendMinor: 150, eligibleSurplusMinor: 100, excludedRewardMinor: 750,
    })
    await evaluateBudgetPeriod(low.body.data.periodId as string, { force: true })
    const lowDetail = await request(app).get(`/api/v1/budget-periods/${low.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(lowDetail.body.data).toMatchObject({
      spendMinor: 150, surplusMinor: 850, eligibleSurplusMinor: 100,
      excludedRewardMinor: 750, synthcoinsAwarded: 1,
    })
    expect(lowDetail.body.data.transactions[0].allocatedMinor).toBe(100)

    const subunitExpense = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Capacidad inferior a un SynthCoin', amountMinor: 99, currency: 'SEK', categoryId,
        occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(subunitExpense.status).toBe(201)
    const subunit = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Residuo menor a unidad', frequency: 'weekly', scope: 'global', limitMinor: 1000,
        currency: 'SEK', startsOn: today,
      })
    expect(subunit.status).toBe(201)
    expect(subunit.body.data).toMatchObject({
      spendMinor: 99, eligibleSurplusMinor: 0, excludedRewardMinor: 901,
    })
    await evaluateBudgetPeriod(subunit.body.data.periodId as string, { force: true })
    const subunitDetail = await request(app).get(`/api/v1/budget-periods/${subunit.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(subunitDetail.body.data).toMatchObject({
      spendMinor: 99, surplusMinor: 901, eligibleSurplusMinor: 0,
      excludedRewardMinor: 901, synthcoinsAwarded: 0,
    })

    const exactExpense = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Gasto exacto recompensado con Flux', amountMinor: 100, currency: 'NOK', categoryId,
        occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(exactExpense.status).toBe(201)
    const exact = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Límite exacto inmutable', frequency: 'weekly', scope: 'global', limitMinor: 100,
        currency: 'NOK', startsOn: today,
      })
    expect(exact.status).toBe(201)
    await evaluateBudgetPeriod(exact.body.data.periodId as string, { force: true })
    const exactDetail = await request(app).get(`/api/v1/budget-periods/${exact.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(exactDetail.body.data).toMatchObject({
      spendMinor: 100, surplusMinor: 0, eligibleSurplusMinor: 0,
      synthcoinsAwarded: 0, fluxAwarded: 25,
    })
    const rejectedExactDelete = await request(app).delete(`/api/v1/transactions/${exactExpense.body.data.transaction.id as string}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
    expect(rejectedExactDelete.status).toBe(409)
    expect(rejectedExactDelete.body.error.code).toBe('REWARDED_TRANSACTION_LOCKED')
    const exactAdjustment = await request(app)
      .post(`/api/v1/transactions/${exactExpense.body.data.transaction.id as string}/adjustments`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({ reason: 'Corrección del gasto exacto', occurredAt: new Date().toISOString() })
    expect(exactAdjustment.status).toBe(201)

    const zeroCoinLedgers = await pool.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM synthcoin_ledger
       WHERE period_id = ANY($1::uuid[])
    `, [[overlapPeriodId, emptyPeriodId, subunit.body.data.periodId, exact.body.data.periodId]])
    expect(zeroCoinLedgers.rows[0]?.count).toBe('0')

    const locks = await pool.query<{ id: string; locked_by_reward: boolean }>(`
      SELECT id, locked_by_reward FROM financial_transactions
       WHERE id = ANY($1::uuid[])
    `, [[lowExpense.body.data.transaction.id, subunitExpense.body.data.transaction.id]])
    expect(locks.rows.every((row) => row.locked_by_reward)).toBe(true)

    const balanceAfter = await pool.query<{ synthcoin_balance: string }>(
      'SELECT synthcoin_balance::text FROM user_progress WHERE user_id = $1', [userId],
    )
    expect(Number(balanceAfter.rows[0]?.synthcoin_balance) - Number(balanceBefore.rows[0]?.synthcoin_balance)).toBe(1)
    for (const budgetId of [overlap.body.data.id, empty.body.data.id, low.body.data.id, subunit.body.data.id, exact.body.data.id]) {
      await request(app).delete(`/api/v1/budgets/${budgetId as string}`).set('Authorization', `Bearer ${token}`)
    }
  })

  test('cerrar un periodo pausado aplica daño una sola vez y no lo renueva', async () => {
    const dates = await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )
    const created = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Límite de daño comprometido', frequency: 'weekly', scope: 'category', categoryId,
        limitMinor: 100, currency: 'EUR', startsOn: dates.rows[0]?.today,
      })
    expect(created.status).toBe(201)
    const budgetId = created.body.data.id as string
    const periodId = created.body.data.periodId as string
    const paused = await request(app).post(`/api/v1/budgets/${budgetId}/pause`).set('Authorization', `Bearer ${token}`)
    expect(paused.status).toBe(200)
    expect(paused.body.data.status).toBe('paused')

    const first = await evaluateBudgetPeriod(periodId, { force: true })
    const replay = await evaluateBudgetPeriod(periodId, { force: true })
    expect(first).toMatchObject({ status: 'exceeded', evaluated: true })
    expect(replay).toMatchObject({ status: 'exceeded', evaluated: false })
    const effects = await pool.query<{ damage_events: string; penalties: string; open_periods: string }>(`
      SELECT
        (SELECT count(*)::text FROM damage_events WHERE period_id = $1) AS damage_events,
        (SELECT count(*)::text FROM budget_penalties WHERE period_id = $1) AS penalties,
        (SELECT count(*)::text FROM budget_periods WHERE budget_id = $2 AND status = 'open') AS open_periods
    `, [periodId, budgetId])
    expect(effects.rows[0]).toMatchObject({ damage_events: '1', penalties: '1', open_periods: '0' })

    const boundary = await pool.query<{ ends_at: Date; local_anchor: string }>(`
      SELECT ends_at, (ends_at AT TIME ZONE 'Europe/Madrid')::date::text AS local_anchor
        FROM budget_periods
       WHERE id = $1
    `, [periodId])
    const changed = await request(app).patch(`/api/v1/budgets/${budgetId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ frequency: 'monthly' })
    expect(changed.status).toBe(200)
    const resumed = await request(app).post(`/api/v1/budgets/${budgetId}/resume`).set('Authorization', `Bearer ${token}`)
    expect(resumed.status).toBe(200)
    expect(resumed.body.data.frequency).toBe('monthly')
    expect(resumed.body.data.startsAt).toBe(boundary.rows[0]?.ends_at.toISOString())
    const persistedAnchor = await pool.query<{ starts_on: string }>(
      'SELECT starts_on::text FROM budgets WHERE id = $1', [budgetId],
    )
    expect(persistedAnchor.rows[0]?.starts_on).toBe(boundary.rows[0]?.local_anchor)
    await request(app).delete(`/api/v1/budgets/${budgetId}`).set('Authorization', `Bearer ${token}`)
  })

  test('impide reanudar una categoría archivada y conserva su snapshot ante hard delete', async () => {
    const category = await request(app).post('/api/v1/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Categoría histórica ${randomUUID().slice(0, 8)}`, icon: 'shapes', color: '#986780' })
    expect(category.status).toBe(201)
    const today = (await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )).rows[0]?.today
    const created = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Categoría que será archivada', frequency: 'weekly', scope: 'category',
        categoryId: category.body.data.id, limitMinor: 1000, currency: 'AUD', startsOn: today,
      })
    expect(created.status).toBe(201)
    const removed = await request(app).delete(`/api/v1/categories/${category.body.data.id as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(removed.status).toBe(200)
    expect(removed.body.data.archived).toBe(true)

    const resume = await request(app).post(`/api/v1/budgets/${created.body.data.id as string}/resume`)
      .set('Authorization', `Bearer ${token}`)
    expect(resume.status).toBe(409)
    expect(resume.body.error.code).toBe('BUDGET_CATEGORY_ARCHIVED')
    await expect(pool.query('DELETE FROM categories WHERE id = $1', [category.body.data.id]))
      .rejects.toMatchObject({ code: '23503' })
    const history = await pool.query<{ count: string }>(`
      SELECT count(*)::text AS count FROM budget_periods
       WHERE budget_id = $1 AND category_id_snapshot = $2
    `, [created.body.data.id, category.body.data.id])
    expect(history.rows[0]?.count).toBe('1')

    await pool.query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [created.body.data.id, userId])
    await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [category.body.data.id, userId])
  })

  test('la evaluación individual respeta prioridad canónica y no admite forzar periodos futuros', async () => {
    const categories = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${secondaryToken}`)
    const secondaryCategoryId = categories.body.data[0].id as string
    const occurredAt = new Date(Date.now() - 36 * 3_600_000).toISOString()
    const expense = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Gasto solapado canónico', amountMinor: 1000, currency: 'CAD',
        categoryId: secondaryCategoryId, occurredAt, status: 'posted',
      })
    expect(expense.status).toBe(201)
    const today = (await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )).rows[0]?.today
    const weekly = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Prioridad semanal categoría', frequency: 'weekly', scope: 'category',
        categoryId: secondaryCategoryId, limitMinor: 2000, currency: 'CAD', startsOn: today,
      })
    const monthly = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Objetivo mensual global', frequency: 'monthly', scope: 'global',
        limitMinor: 2000, currency: 'CAD', startsOn: today,
      })
    expect(weekly.status).toBe(201)
    expect(monthly.status).toBe(201)
    await pool.query(`
      UPDATE budget_periods
         SET starts_at = now() - interval '2 days',
             ends_at = now() - interval '1 day'
       WHERE id = ANY($1::uuid[])
    `, [[weekly.body.data.periodId, monthly.body.data.periodId]])

    const target = await evaluateDueBudgetPeriod(monthly.body.data.periodId as string)
    expect(target).toMatchObject({ periodId: monthly.body.data.periodId, status: 'met', evaluated: true })
    const evaluated = await pool.query<{ id: string; eligible_surplus_minor: string; synthcoins_awarded: string }>(`
      SELECT id, eligible_surplus_minor::text, synthcoins_awarded::text
        FROM budget_periods
       WHERE id = ANY($1::uuid[])
       ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END
    `, [[weekly.body.data.periodId, monthly.body.data.periodId], weekly.body.data.periodId])
    expect(evaluated.rows).toEqual([
      { id: weekly.body.data.periodId, eligible_surplus_minor: '1000', synthcoins_awarded: '10' },
      { id: monthly.body.data.periodId, eligible_surplus_minor: '0', synthcoins_awarded: '0' },
    ])
    const future = await pool.query<{ id: string }>(`
      SELECT id FROM budget_periods
       WHERE budget_id = $1 AND status = 'open' AND ends_at > now()
       ORDER BY starts_at DESC LIMIT 1
    `, [monthly.body.data.id])
    await expect(evaluateDueBudgetPeriod(future.rows[0]!.id))
      .rejects.toMatchObject({ code: 'BUDGET_PERIOD_NOT_DUE' })
    await pool.query('DELETE FROM budgets WHERE id = ANY($1::uuid[])', [[weekly.body.data.id, monthly.body.data.id]])
  })

  test('un cierre atrasado conserva una penalización completa desde su evaluación', async () => {
    const occurredAt = new Date(Date.now() - 10 * 86_400_000).toISOString()
    const expense = await request(app).post('/api/v1/transactions')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Gasto de periodo atrasado', amountMinor: 200, currency: 'JPY',
        categoryId, occurredAt, status: 'posted',
      })
    expect(expense.status).toBe(201)
    const today = (await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )).rows[0]?.today
    const created = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Cierre semanal atrasado', frequency: 'weekly', scope: 'global',
        limitMinor: 100, currency: 'JPY', startsOn: today,
      })
    expect(created.status).toBe(201)
    await pool.query(`
      UPDATE budget_periods
         SET starts_at = now() - interval '14 days',
             ends_at = now() - interval '7 days'
       WHERE id = $1
    `, [created.body.data.periodId])
    const deepLink = await request(app).get(`/api/v1/budget-periods/${created.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(deepLink.status).toBe(200)
    expect(deepLink.body.data.status).toBe('exceeded')
    const result = await evaluateBudgetPeriod(created.body.data.periodId as string)
    expect(result).toMatchObject({ status: 'exceeded', evaluated: false })
    const penalty = await pool.query<{ remaining_hours: string }>(`
      SELECT (extract(epoch FROM (ends_at - now())) / 3600)::numeric(10, 2)::text AS remaining_hours
        FROM budget_penalties WHERE period_id = $1
    `, [created.body.data.periodId])
    expect(Number(penalty.rows[0]?.remaining_hours)).toBeGreaterThan(167.9)
    const originalDetail = await request(app).get(`/api/v1/budget-periods/${created.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(originalDetail.body.data.transactions[0]).toMatchObject({
      id: expense.body.data.transaction.id,
      concept: 'Gasto de periodo atrasado',
      amountMinor: 200,
      currency: 'JPY',
    })
    const edited = await request(app).patch(`/api/v1/transactions/${expense.body.data.transaction.id as string}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        type: 'expense', concept: 'Gasto vivo corregido', amountMinor: 300, currency: 'JPY',
        categoryId, occurredAt: new Date().toISOString(), status: 'posted',
      })
    expect(edited.status).toBe(200)
    const afterEdit = await request(app).get(`/api/v1/budget-periods/${created.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(afterEdit.body.data.transactions[0]).toMatchObject({
      id: expense.body.data.transaction.id,
      concept: 'Gasto de periodo atrasado',
      amountMinor: 200,
    })
    const removed = await request(app).delete(`/api/v1/transactions/${expense.body.data.transaction.id as string}`)
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
    expect(removed.status).toBe(200)
    const afterDelete = await request(app).get(`/api/v1/budget-periods/${created.body.data.periodId as string}`)
      .set('Authorization', `Bearer ${token}`)
    expect(afterDelete.body.data.transactions[0]).toMatchObject({
      id: expense.body.data.transaction.id,
      concept: 'Gasto de periodo atrasado',
      amountMinor: 200,
    })
    await pool.query('DELETE FROM budgets WHERE id = $1', [created.body.data.id])
  })

  test('rechaza vínculos económicos cruzados entre usuarios y conserva el cascade de cuenta', async () => {
    const period = await pool.query<{ id: string }>(`
      SELECT p.id FROM budget_periods p
      LEFT JOIN budget_penalties penalty ON penalty.period_id = p.id
      LEFT JOIN damage_events damage ON damage.period_id = p.id
      WHERE p.user_id = $1 AND penalty.id IS NULL AND damage.id IS NULL
      ORDER BY p.created_at LIMIT 1
    `, [userId])
    const foreignTransaction = await pool.query<{ id: string }>(`
      SELECT id FROM financial_transactions WHERE user_id = $1 ORDER BY created_at LIMIT 1
    `, [secondaryUserId])
    const periodId = period.rows[0]?.id
    const transactionId = foreignTransaction.rows[0]?.id
    expect(periodId).toBeTruthy()
    expect(transactionId).toBeTruthy()

    await expect(pool.query(`
      INSERT INTO budget_period_transactions
        (user_id, period_id, transaction_id, source_transaction_id, type_snapshot,
         concept_snapshot, amount_minor_snapshot, currency_snapshot, occurred_at_snapshot, counted_minor)
      VALUES ($1, $2, $3, $3, 'expense', 'cross-user', 1, 'EUR', now(), 1)
    `, [userId, periodId, transactionId])).rejects.toMatchObject({ code: '23503' })
    await expect(pool.query(`
      INSERT INTO reward_allocations
        (user_id, period_id, transaction_id, allocated_minor, allocation_order)
      VALUES ($1, $2, $3, 1, 999)
    `, [userId, periodId, transactionId])).rejects.toMatchObject({ code: '23503' })
    await expect(pool.query(`
      INSERT INTO synthcoin_ledger
        (user_id, type, amount, balance_after, period_id, idempotency_key)
      VALUES ($1, 'adjustment', 1, 1, $2, $3)
    `, [secondaryUserId, periodId, randomUUID()])).rejects.toMatchObject({ code: '23503' })
    await expect(pool.query(`
      INSERT INTO budget_penalties (user_id, period_id, starts_at, ends_at)
      VALUES ($1, $2, now(), now() + interval '1 day')
    `, [secondaryUserId, periodId])).rejects.toMatchObject({ code: '23503' })
    await expect(pool.query(`
      INSERT INTO damage_events (user_id, period_id, base_damage, idempotency_key)
      VALUES ($1, $2, 1, $3)
    `, [secondaryUserId, periodId, randomUUID()])).rejects.toMatchObject({ code: '23503' })

    const module = await pool.query<{ id: string }>(`
      INSERT INTO user_module_instances
        (user_id, definition_id, slot, original_price_coins, power_snapshot, shield_snapshot, energy, state)
      SELECT $1, id, slot, price_coins, power, shield, 100, 'equipped'
        FROM module_definitions WHERE sku = 'CPU-NEURAL-FORGE'
      RETURNING id
    `, [secondaryUserId])
    const damage = await pool.query<{ id: string }>(`
      INSERT INTO damage_events (user_id, base_damage, idempotency_key)
      VALUES ($1, 1, $2) RETURNING id
    `, [userId, randomUUID()])
    await expect(pool.query(`
      INSERT INTO module_damage_events
        (user_id, damage_event_id, module_instance_id, shield_snapshot,
         energy_before, damage_applied, energy_after, destroyed)
      VALUES ($1, $2, $3, 0, 100, 1, 99, false)
    `, [userId, damage.rows[0]?.id, module.rows[0]?.id])).rejects.toMatchObject({ code: '23503' })
    await pool.query('DELETE FROM damage_events WHERE id = $1', [damage.rows[0]?.id])
    await pool.query('DELETE FROM user_module_instances WHERE id = $1', [module.rows[0]?.id])

    const cascadeEmail = `cascade-${randomUUID()}@budgetrunner.local`
    const cascadeUser = await register(cascadeEmail, 'Cascade Runner')
    const cascadeCategories = await request(app).get('/api/v1/categories')
      .set('Authorization', `Bearer ${cascadeUser.accessToken}`)
    const today = (await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )).rows[0]?.today
    const cascadeBudget = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${cascadeUser.accessToken}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Cascade category budget', frequency: 'weekly', scope: 'category',
        categoryId: cascadeCategories.body.data[0].id, limitMinor: 1000, currency: 'EUR', startsOn: today,
      })
    expect(cascadeBudget.status).toBe(201)
    await pool.query('DELETE FROM users WHERE id = $1', [cascadeUser.user.id])
    const orphan = await pool.query('SELECT 1 FROM budget_periods WHERE id = $1', [cascadeBudget.body.data.periodId])
    expect(orphan.rowCount).toBe(0)
  })

  test('cierra importes agregados por encima de MAX_SAFE sin perder precisión ni desbordar enteros de daño', async () => {
    const categories = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${secondaryToken}`)
    const secondaryCategoryId = categories.body.data[0].id as string
    const today = (await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )).rows[0]?.today
    const created = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Rango monetario exacto', frequency: 'weekly', scope: 'global',
        limitMinor: 1, currency: 'XTS', startsOn: today,
      })
    expect(created.status).toBe(201)

    const transactions = await pool.query<{ id: string }>(`
      INSERT INTO financial_transactions
        (user_id, category_id, type, status, concept, amount_minor, currency, occurred_at)
      VALUES
        ($1, $2, 'expense', 'posted', 'Tramo exacto A', 9000000000000000, 'XTS', now() - interval '2 days'),
        ($1, $2, 'expense', 'posted', 'Tramo exacto B', 9000000000000000, 'XTS', now() - interval '2 days')
      RETURNING id
    `, [secondaryUserId, secondaryCategoryId])
    await pool.query(`
      UPDATE budget_periods
         SET starts_at = now() - interval '3 days', ends_at = now() - interval '1 day'
       WHERE id = $1
    `, [created.body.data.periodId])

    const result = await evaluateDueBudgetPeriod(created.body.data.periodId as string)
    expect(result).toMatchObject({ status: 'exceeded', evaluated: true })
    const period = await pool.query<{
      spend_minor: string
      excess_percent_bp: number
      base_damage: number
    }>(`
      SELECT spend_minor::text, excess_percent_bp, base_damage
        FROM budget_periods WHERE id = $1
    `, [created.body.data.periodId])
    expect(period.rows[0]).toEqual({
      spend_minor: '18000000000000000',
      excess_percent_bp: 2_147_483_647,
      base_damage: 2_147_483_647,
    })

    await pool.query('DELETE FROM budgets WHERE id = $1', [created.body.data.id])
    await pool.query('DELETE FROM financial_transactions WHERE id = ANY($1::uuid[])', [transactions.rows.map((row) => row.id)])
  })

  test('aísla un periodo fuera de rango para que el job siga cerrando otras cuentas', async () => {
    const primaryToday = (await pool.query<{ today: string }>(
      "SELECT (now() AT TIME ZONE 'Europe/Madrid')::date::text AS today",
    )).rows[0]?.today
    const secondaryCategory = await pool.query<{ id: string }>(
      'SELECT id FROM categories WHERE user_id = $1 ORDER BY created_at LIMIT 1',
      [secondaryUserId],
    )
    const poison = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${token}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Periodo aislado fuera de rango', frequency: 'weekly', scope: 'global',
        limitMinor: 1, currency: 'XBA', startsOn: primaryToday,
      })
    const healthy = await request(app).post('/api/v1/budgets')
      .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
      .send({
        name: 'Periodo posterior saludable', frequency: 'weekly', scope: 'global',
        limitMinor: 1, currency: 'XBB', startsOn: primaryToday,
      })
    expect(poison.status).toBe(201)
    expect(healthy.status).toBe(201)

    const inserted = await pool.query<{ id: string }>(`
      INSERT INTO financial_transactions
        (user_id, category_id, type, status, concept, amount_minor, currency, occurred_at)
      VALUES
        ($1, $2, 'expense', 'posted', 'Máximo bigint', 9223372036854775807, 'XBA', '2000-01-04T00:00:00Z'),
        ($1, $2, 'expense', 'posted', 'Desborde agregado', 1, 'XBA', '2000-01-04T00:00:00Z'),
        ($3, $4, 'expense', 'posted', 'Cierre saludable', 2, 'XBB', '2000-01-12T00:00:00Z')
      RETURNING id
    `, [userId, categoryId, secondaryUserId, secondaryCategory.rows[0]?.id])
    await pool.query(`
      UPDATE budget_periods
         SET starts_at = '2000-01-01T00:00:00Z', ends_at = '2000-01-08T00:00:00Z'
       WHERE id = $1
    `, [poison.body.data.periodId])
    await pool.query(`
      UPDATE budget_periods
         SET starts_at = '2000-01-09T00:00:00Z', ends_at = '2000-01-16T00:00:00Z'
       WHERE id = $1
    `, [healthy.body.data.periodId])

    const job = await request(internalJobApp).post('/api/v1/internal/jobs/close-due-periods?limit=2')
      .set('Authorization', `Bearer ${internalJobSecret}`)
    expect(job.status).toBe(207)
    expect(job.body.data.evaluated).toBe(1)
    expect(job.body.data.failed).toBe(1)
    expect(job.body.data.results).toContainEqual({
      periodId: poison.body.data.periodId,
      status: 'error',
      evaluated: false,
      errorCode: 'BUDGET_PERIOD_TOTAL_OUT_OF_RANGE',
    })
    expect(job.body.data.results).toContainEqual(expect.objectContaining({
      periodId: healthy.body.data.periodId,
      status: 'exceeded',
      evaluated: true,
    }))
    const jobRun = await pool.query<{ status: string; error_code: string }>(`
      SELECT status, error_code FROM job_runs WHERE id = $1
    `, [job.body.data.runId])
    expect(jobRun.rows[0]).toEqual({ status: 'failed', error_code: 'PARTIAL_FAILURE' })
    const states = await pool.query<{ id: string; status: string }>(`
      SELECT id, status::text FROM budget_periods WHERE id = ANY($1::uuid[])
    `, [[poison.body.data.periodId, healthy.body.data.periodId]])
    expect(states.rows.find((row) => row.id === poison.body.data.periodId)?.status).toBe('open')
    expect(states.rows.find((row) => row.id === healthy.body.data.periodId)?.status).toBe('exceeded')

    await pool.query('DELETE FROM budgets WHERE id = ANY($1::uuid[])', [[poison.body.data.id, healthy.body.data.id]])
    await pool.query('DELETE FROM financial_transactions WHERE id = ANY($1::uuid[])', [inserted.rows.map((row) => row.id)])
  })

  test('dashboard agrupa la cola tras cuatro categorías sin perder importes', async () => {
    const categoryResponse = await request(app).get('/api/v1/categories').set('Authorization', `Bearer ${secondaryToken}`)
    const categoryIds = (categoryResponse.body.data as Array<{ id: string }>).slice(0, 6).map((category) => category.id)
    expect(categoryIds).toHaveLength(6)
    const transactionIds: string[] = []
    const amounts = [256, 256, 256, 231, 1, 1]
    for (const [index, id] of categoryIds.entries()) {
      const created = await request(app).post('/api/v1/transactions')
        .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
        .send({
          type: 'expense', concept: `Distribución ${index + 1}`, amountMinor: amounts[index],
          currency: 'EUR', categoryId: id, occurredAt: new Date().toISOString(), status: 'posted',
        })
      expect(created.status).toBe(201)
      transactionIds.push(created.body.data.transaction.id as string)
    }
    const dashboard = await request(app).get('/api/v1/dashboard?period=month').set('Authorization', `Bearer ${secondaryToken}`)
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.data.distribution).toHaveLength(5)
    expect(dashboard.body.data.distribution.reduce((sum: number, item: { percentage: number }) => sum + item.percentage, 0)).toBe(100)
    expect(dashboard.body.data.distribution.some((item: { systemKey?: string }) => item.systemKey === 'systemCategory.other')).toBe(true)
    const expected = await pool.query<{ amount: string }>(`
      SELECT coalesce(sum(tx.amount_minor), 0)::text AS amount
        FROM users owner
        JOIN financial_transactions tx ON tx.user_id = owner.id
       WHERE owner.id = $1
         AND tx.type = 'expense'
         AND tx.status = 'posted'
         AND tx.currency = owner.primary_currency
         AND tx.occurred_at >= (date_trunc('month', now() AT TIME ZONE owner.timezone) AT TIME ZONE owner.timezone)
         AND tx.occurred_at < ((date_trunc('month', now() AT TIME ZONE owner.timezone) + interval '1 month') AT TIME ZONE owner.timezone)
         AND tx.occurred_at <= now()
    `, [secondaryUserId])
    expect(dashboard.body.data.distribution.reduce((sum: number, item: { amountMinor: number }) => sum + item.amountMinor, 0))
      .toBe(Number(expected.rows[0]?.amount))
    for (const transactionId of transactionIds) {
      await request(app).delete(`/api/v1/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${secondaryToken}`).set('Idempotency-Key', randomUUID())
    }
  })
})
