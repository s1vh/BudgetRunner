import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { closeDatabase, pool, withTransaction } from '../src/db.js'
import { findOrCreateGoogleUser } from '../src/googleOAuth.js'

const app = createApp()
const password = 'TestRunner!2026'
const primaryEmail = `api-${randomUUID()}@budgetrunner.local`
const secondaryEmail = `isolation-${randomUUID()}@budgetrunner.local`
const googleOnlyEmail = `google-${randomUUID()}@budgetrunner.local`
let token = ''
let secondaryToken = ''
let userId = ''
let categoryId = ''
let offerId = ''
let damagedModuleId = ''

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
    expect(initial.body.data.guidedTourCompleted).toBe(false)

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
})
