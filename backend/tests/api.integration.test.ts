import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createApp } from '../src/app.js'
import { closeDatabase, pool } from '../src/db.js'

const app = createApp()
const password = 'TestRunner!2026'
const primaryEmail = `api-${randomUUID()}@budgetrunner.local`
const secondaryEmail = `isolation-${randomUUID()}@budgetrunner.local`
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
  await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [primaryEmail, secondaryEmail])
  await closeDatabase()
})

describe.sequential('Budget Runner API', () => {
  test('protege las rutas privadas', async () => {
    const response = await request(app).get('/api/v1/transactions')
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED')
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
