import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { closeDatabase, pool } from '../src/db.js'
import { ensureCurrentStoreRotation } from '../src/storeRotation.js'

const firstEmail = `store-concurrency-${randomUUID()}@budgetrunner.local`
const secondEmail = `store-isolation-${randomUUID()}@budgetrunner.local`
let firstUserId = ''
let secondUserId = ''

async function createUser(email: string, level: number) {
  const user = await pool.query<{ id: string }>(`
    INSERT INTO users (email, display_name, primary_currency, locale, timezone, week_starts_on)
    VALUES ($1, 'Store Runner', 'EUR', 'en-US', 'Europe/Madrid', 1)
    RETURNING id
  `, [email])
  const userId = user.rows[0]?.id
  if (!userId) throw new Error('Store test user could not be created')
  await pool.query('INSERT INTO user_progress (user_id, level) VALUES ($1, $2)', [userId, level])
  return userId
}

beforeAll(async () => {
  firstUserId = await createUser(firstEmail, 1)
  secondUserId = await createUser(secondEmail, 10)
})

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email IN ($1, $2)', [firstEmail, secondEmail])
  await closeDatabase()
})

describe.sequential('persisted weekly store rotations', () => {
  const instant = new Date('2026-09-10T12:00:00.000Z')

  test('is idempotent and concurrency-safe for one user', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => ensureCurrentStoreRotation(firstUserId, instant)),
    )
    expect(new Set(results.map((rotation) => rotation.id))).toHaveLength(1)
    expect(new Set(results.map((rotation) => rotation.seed))).toHaveLength(1)
    expect(results.filter((rotation) => rotation.created)).toHaveLength(1)
    expect(results.every((rotation) => rotation.offerCount === 6)).toBe(true)

    const persisted = await pool.query<{
      rotations: string
      offers: string
      distinct_definitions: string
      starts_at: Date
      ends_at: Date
      seed: string
      user_level_snapshot: number
    }>(`
      SELECT count(DISTINCT r.id)::text AS rotations,
             count(o.id)::text AS offers,
             count(DISTINCT o.module_definition_id)::text AS distinct_definitions,
             min(r.starts_at) AS starts_at,
             max(r.ends_at) AS ends_at,
             min(r.seed) AS seed,
             min(r.user_level_snapshot) AS user_level_snapshot
        FROM store_rotations r
        JOIN store_offers o ON o.rotation_id = r.id
       WHERE r.user_id = $1 AND r.starts_at = $2
    `, [firstUserId, new Date('2026-09-06T02:00:00.000Z')])
    expect(persisted.rows[0]).toMatchObject({
      rotations: '1',
      offers: '6',
      distinct_definitions: '6',
      user_level_snapshot: 1,
    })
    expect(persisted.rows[0]?.starts_at.toISOString()).toBe('2026-09-06T02:00:00.000Z')
    expect(persisted.rows[0]?.ends_at.toISOString()).toBe('2026-09-13T02:00:00.000Z')
    expect(persisted.rows[0]?.seed).toMatch(/^[0-9a-f]{64}$/)
  })

  test('isolates users and snapshots each user level', async () => {
    const first = await ensureCurrentStoreRotation(firstUserId, instant)
    const second = await ensureCurrentStoreRotation(secondUserId, instant)
    expect(second.id).not.toBe(first.id)
    expect(second.seed).not.toBe(first.seed)
    expect(second.userLevelSnapshot).toBe(10)
    expect(second.offerCount).toBe(6)

    const foreignRows = await pool.query<{ count: string }>(`
      SELECT count(*)::text AS count
        FROM store_offers o
        JOIN store_rotations r ON r.id = o.rotation_id
       WHERE r.user_id = $1 AND r.id = $2
    `, [firstUserId, second.id])
    expect(foreignRows.rows[0]?.count).toBe('0')

    await pool.query('UPDATE user_progress SET level = 11 WHERE user_id = $1', [secondUserId])
    const retry = await ensureCurrentStoreRotation(secondUserId, instant)
    expect(retry.id).toBe(second.id)
    expect(retry.userLevelSnapshot).toBe(10)
  })

  test('creates a fresh six-offer rotation at the next boundary', async () => {
    const oldRotation = await ensureCurrentStoreRotation(firstUserId, new Date('2026-09-13T01:59:59.999Z'))
    const newRotation = await ensureCurrentStoreRotation(firstUserId, new Date('2026-09-13T02:00:00.000Z'))
    expect(newRotation.id).not.toBe(oldRotation.id)
    expect(newRotation.seed).not.toBe(oldRotation.seed)
    expect(newRotation.startsAt.toISOString()).toBe('2026-09-13T02:00:00.000Z')
    expect(newRotation.offerCount).toBe(6)

    const statuses = await pool.query<{ id: string; status: string }>(`
      SELECT id, status FROM store_rotations WHERE user_id = $1 AND id = ANY($2::uuid[])
    `, [firstUserId, [oldRotation.id, newRotation.id]])
    expect(statuses.rows.find((row) => row.id === oldRotation.id)?.status).toBe('expired')
    expect(statuses.rows.find((row) => row.id === newRotation.id)?.status).toBe('active')
  })
})
