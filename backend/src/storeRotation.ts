import type { DbClient } from './db.js'

export async function rotateStoreForPeriod(
  client: DbClient,
  input: { userId: string; periodId: string; startsAt: Date; endsAt: Date },
) {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM store_rotations WHERE source_period_id = $1 LIMIT 1',
    [input.periodId],
  )
  if (existing.rows[0]) return existing.rows[0].id

  const progress = await client.query<{ level: number }>(
    'SELECT level FROM user_progress WHERE user_id = $1 FOR UPDATE',
    [input.userId],
  )
  const level = progress.rows[0]?.level ?? 1
  await client.query(`UPDATE store_rotations SET status = 'expired'
    WHERE user_id = $1 AND status = 'active'`, [input.userId])

  const seed = `${input.userId}:${input.periodId}`
  const active = input.endsAt.getTime() > Date.now()
  const rotation = await client.query<{ id: string }>(`
    INSERT INTO store_rotations
      (user_id, source_period_id, starts_at, ends_at, seed, user_level_snapshot, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [input.userId, input.periodId, input.startsAt, input.endsAt, seed, level, active ? 'active' : 'expired'])
  const rotationId = rotation.rows[0]?.id
  if (!rotationId) throw new Error('Store rotation insert failed')

  await client.query(`
    INSERT INTO store_offers
      (rotation_id, module_definition_id, price_snapshot, min_level_snapshot, expires_at)
    SELECT $1, d.id, d.price_coins, d.min_level, $2
      FROM module_definitions d
     WHERE d.active = true AND d.min_level <= $3
     ORDER BY md5($4 || d.id::text)
     LIMIT 6
  `, [rotationId, input.endsAt, Math.max(1, level), seed])
  return rotationId
}
