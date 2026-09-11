import { createHmac, randomBytes } from 'node:crypto'
import type { DbClient } from './db.js'

export const STORE_OFFERS_PER_ROTATION = 6
export const STORE_ROTATION_WEEK_MS = 7 * 24 * 60 * 60 * 1_000

export type StoreRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface StoreRotationWindow {
  startsAt: Date
  endsAt: Date
}

export interface StoreDefinitionCandidate {
  id: string
  rarity: StoreRarity
  priceCoins: number
  minLevel: number
}

export interface StoreRotationResult extends StoreRotationWindow {
  id: string
  seed: string
  userLevelSnapshot: number
  offerCount: number
  created: boolean
}

interface RotationRow {
  id: string
  seed: string
  user_level_snapshot: number
}

interface DefinitionRow {
  id: string
  rarity: StoreRarity
  price_coins: string
  min_level: number
}

const rarityRank: Record<StoreRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

/**
 * Returns the fixed UTC store window containing `instant`.
 * Windows are half-open: Sunday 02:00:00.000Z is included in the new week.
 */
export function getStoreRotationWindow(instant: Date = new Date()): StoreRotationWindow {
  if (!Number.isFinite(instant.getTime())) throw new TypeError('A valid instant is required')
  const sundayAtTwo = Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate() - instant.getUTCDay(),
    2,
  )
  const startsAtMs = instant.getTime() < sundayAtTwo ? sundayAtTwo - STORE_ROTATION_WEEK_MS : sundayAtTwo
  return {
    startsAt: new Date(startsAtMs),
    endsAt: new Date(startsAtMs + STORE_ROTATION_WEEK_MS),
  }
}

function deterministicUnit(seed: string, definitionId: string) {
  const digest = createHmac('sha256', seed).update(definitionId).digest()
  const upper = digest.readUInt32BE(0)
  const lower = digest.readUInt32BE(4) >>> 11
  const integer = upper * 2 ** 21 + lower
  return (integer + 1) / (2 ** 53 + 1)
}

function selectionWeight(
  definition: StoreDefinitionCandidate,
  level: number,
  minimumPrice: number,
  maximumPrice: number,
) {
  const targetRarity = clamp(Math.floor((level - 1) / 2), 0, 4)
  const rarityDistance = Math.abs(rarityRank[definition.rarity] - targetRarity)
  const rarityAffinity = Math.exp(-0.8 * rarityDistance)

  const priceRange = Math.max(1, maximumPrice - minimumPrice)
  const pricePosition = (definition.priceCoins - minimumPrice) / priceRange
  const targetPricePosition = clamp((level - 1) / 9, 0, 1)
  const priceAffinity = Math.exp(-1.1 * Math.abs(pricePosition - targetPricePosition))

  // At higher levels, definitions unlocked recently should remain more visible than starter gear.
  const unlockProximity = 1 + 1.5 * (definition.minLevel / Math.max(1, level)) ** 2
  return Math.max(Number.EPSILON, rarityAffinity * priceAffinity * unlockProximity)
}

/**
 * Deterministic weighted sampling without replacement. The seed itself is generated with
 * cryptographic randomness and persisted; hashing it per definition makes retries reproducible.
 */
export function selectStoreDefinitions(
  definitions: readonly StoreDefinitionCandidate[],
  userLevel: number,
  seed: string,
  count = STORE_OFFERS_PER_ROTATION,
) {
  const level = Math.max(1, Math.trunc(userLevel))
  const eligible = definitions.filter((definition) => definition.minLevel <= level)
  if (eligible.length < count) {
    throw new Error(`Store catalog has ${eligible.length} eligible modules for level ${level}; ${count} are required`)
  }
  const minimumPrice = Math.min(...eligible.map((definition) => definition.priceCoins))
  const maximumPrice = Math.max(...eligible.map((definition) => definition.priceCoins))
  return eligible
    .map((definition) => {
      const weight = selectionWeight(definition, level, minimumPrice, maximumPrice)
      return { definition, score: -Math.log(deterministicUnit(seed, definition.id)) / weight }
    })
    .sort((left, right) => left.score - right.score || left.definition.id.localeCompare(right.definition.id))
    .slice(0, count)
    .map(({ definition }) => definition)
}

async function ensureRotationOffers(
  client: DbClient,
  rotation: RotationRow,
  endsAt: Date,
) {
  const definitions = await client.query<DefinitionRow>(`
    SELECT id, rarity::text AS rarity, price_coins::text, min_level
      FROM module_definitions
     WHERE active = true AND min_level <= $1
     ORDER BY id
  `, [rotation.user_level_snapshot])
  const candidates = definitions.rows.map((definition) => ({
    id: definition.id,
    rarity: definition.rarity,
    priceCoins: Number(definition.price_coins),
    minLevel: definition.min_level,
  }))
  const selected = selectStoreDefinitions(candidates, rotation.user_level_snapshot, rotation.seed)
  const existing = await client.query<{ module_definition_id: string }>(`
    SELECT module_definition_id
      FROM store_offers
     WHERE rotation_id = $1
  `, [rotation.id])
  const existingIds = new Set(existing.rows.map((offer) => offer.module_definition_id))
  let offerCount = existingIds.size
  for (const definition of selected) {
    if (offerCount >= STORE_OFFERS_PER_ROTATION) break
    if (existingIds.has(definition.id)) continue
    const inserted = await client.query(`
      INSERT INTO store_offers
        (rotation_id, module_definition_id, price_snapshot, min_level_snapshot, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (rotation_id, module_definition_id) DO NOTHING
    `, [rotation.id, definition.id, definition.priceCoins, definition.minLevel, endsAt])
    if (inserted.rowCount) {
      existingIds.add(definition.id)
      offerCount += 1
    }
  }
  if (offerCount < STORE_OFFERS_PER_ROTATION) {
    throw new Error(`Store rotation ${rotation.id} contains only ${offerCount} offers`)
  }
  return offerCount
}

export async function ensureStoreRotationWithClient(
  client: DbClient,
  userId: string,
  instant: Date = new Date(),
  seedFactory: () => string = () => randomBytes(32).toString('hex'),
): Promise<StoreRotationResult> {
  const window = getStoreRotationWindow(instant)
  // This lock is independent per user and is acquired before the first MVCC read, so two
  // lazy requests (or a request racing the cron) cannot create different seeds for one window.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`store-rotation:${userId}`])
  const progress = await client.query<{ level: number }>(
    'SELECT level FROM user_progress WHERE user_id = $1 FOR UPDATE',
    [userId],
  )
  const level = progress.rows[0]?.level
  if (!level) throw new Error(`Progress row missing for store user ${userId}`)

  let rotation = (await client.query<RotationRow>(`
    SELECT id, seed, user_level_snapshot
      FROM store_rotations
     WHERE user_id = $1 AND starts_at = $2 AND ends_at = $3
       AND source_period_id IS NULL
     LIMIT 1
  `, [userId, window.startsAt, window.endsAt])).rows[0]
  let created = false

  if (!rotation) {
    const seed = seedFactory()
    if (!seed) throw new Error('Store seed factory returned an empty seed')
    await client.query(`
      UPDATE store_rotations
         SET status = 'expired'
       WHERE user_id = $1 AND status = 'active'
    `, [userId])
    const inserted = await client.query<RotationRow>(`
      INSERT INTO store_rotations
        (user_id, starts_at, ends_at, seed, user_level_snapshot, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT (user_id, starts_at) WHERE source_period_id IS NULL DO NOTHING
      RETURNING id, seed, user_level_snapshot
    `, [userId, window.startsAt, window.endsAt, seed, level])
    rotation = inserted.rows[0]
    created = Boolean(rotation)
    if (!rotation) {
      rotation = (await client.query<RotationRow>(`
        SELECT id, seed, user_level_snapshot
          FROM store_rotations
         WHERE user_id = $1 AND starts_at = $2 AND ends_at = $3
           AND source_period_id IS NULL
         LIMIT 1
      `, [userId, window.startsAt, window.endsAt])).rows[0]
    }
  }
  if (!rotation) throw new Error('Store rotation insert failed')

  await client.query(`
    UPDATE store_rotations
       SET status = 'expired'
     WHERE user_id = $1 AND id <> $2 AND status = 'active'
  `, [userId, rotation.id])
  await client.query(`
    UPDATE store_rotations
       SET status = 'active'
     WHERE id = $1 AND status <> 'active'
  `, [rotation.id])
  const offerCount = await ensureRotationOffers(client, rotation, window.endsAt)
  return {
    id: rotation.id,
    seed: rotation.seed,
    userLevelSnapshot: rotation.user_level_snapshot,
    offerCount,
    created,
    ...window,
  }
}

export async function ensureCurrentStoreRotation(userId: string, instant: Date = new Date()) {
  const { withTransaction } = await import('./db.js')
  return withTransaction((client) => ensureStoreRotationWithClient(client, userId, instant))
}

export interface RotateStoreJobResult {
  window: { startsAt: string; endsAt: string }
  attempted: number
  created: number
  unchanged: number
  failed: Array<{ userId: string; message: string }>
}

export async function rotateStoreForAllUsers(
  options: { instant?: Date; limit?: number } = {},
): Promise<RotateStoreJobResult> {
  const { pool } = await import('./db.js')
  const instant = options.instant ?? new Date()
  const limit = clamp(Math.trunc(options.limit ?? 5_000), 1, 10_000)
  const users = await pool.query<{ id: string }>(`
    SELECT u.id
      FROM users u
      JOIN user_progress p ON p.user_id = u.id
     WHERE u.deleted_at IS NULL
     ORDER BY u.id
     LIMIT $1
  `, [limit])
  const rotations: StoreRotationResult[] = []
  const failed: Array<{ userId: string; message: string }> = []
  for (const user of users.rows) {
    try {
      rotations.push(await ensureCurrentStoreRotation(user.id, instant))
    } catch (error) {
      failed.push({ userId: user.id, message: error instanceof Error ? error.message : 'Unknown store rotation error' })
    }
  }
  const window = getStoreRotationWindow(instant)
  const created = rotations.filter((rotation) => rotation.created).length
  return {
    window: { startsAt: window.startsAt.toISOString(), endsAt: window.endsAt.toISOString() },
    attempted: users.rows.length,
    created,
    unchanged: rotations.length - created,
    failed,
  }
}
