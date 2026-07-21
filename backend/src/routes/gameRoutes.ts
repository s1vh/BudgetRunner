import { Router } from 'express'
import { z } from 'zod'
import { type AppRequest, requireAuth } from '../auth.js'
import { type DbClient, pool, withTransaction } from '../db.js'
import { ApiError, asyncHandler } from '../errors.js'
import { getFamilyBonuses, getProgressSummary, recalculateProgress } from '../progress.js'

const slotLabels: Record<string, string> = {
  cpu: 'Neural Chip', gpu: 'Holographic Core', ram: 'Memory Module', display: 'Neon Display',
  expansion: 'Expansion Board', jammer: 'Frequency Jammer', network: 'Quantum NIC', cooling: 'Cryo Cooler',
  projector: 'Hologram Projector', power: 'Fusion Cell',
}

function moduleDto(row: Record<string, unknown>) {
  const priceCoins = Number(row.original_price_coins ?? row.price_snapshot ?? row.price_coins)
  const energy = Number(row.energy ?? 100)
  return {
    instanceId: String(row.instance_id),
    name: String(row.name),
    family: String(row.family),
    rarity: String(row.rarity),
    power: Number(row.power_snapshot ?? row.power),
    shield: Number(row.shield_snapshot ?? row.shield),
    energy,
    state: String(row.state ?? 'equipped'),
    priceCoins,
    ...(energy > 0 && energy < 100 ? { repairCost: Math.ceil(priceCoins * (100 - energy) / 100) } : {}),
    description: String(row.description),
    ...(row.sku ? { descriptionKey: `module.${String(row.sku)}.description` } : {}),
  }
}

async function getCyberdeck(client: DbClient, userId: string) {
  const result = await client.query(`
    SELECT slots.slot::text AS slot, slots.ordinality,
           selected.id AS instance_id, selected.power_snapshot, selected.shield_snapshot,
           selected.energy, selected.state::text, selected.original_price_coins,
           d.name, d.sku, d.family::text, d.rarity::text, d.description
      FROM unnest(enum_range(NULL::module_slot)) WITH ORDINALITY AS slots(slot, ordinality)
      LEFT JOIN LATERAL (
        SELECT i.* FROM user_module_instances i
         WHERE i.user_id = $1 AND i.slot = slots.slot AND i.state IN ('equipped', 'destroyed')
         ORDER BY (i.state = 'equipped') DESC, coalesce(i.destroyed_at, i.equipped_at) DESC
         LIMIT 1
      ) selected ON true
      LEFT JOIN module_definitions d ON d.id = selected.definition_id
     ORDER BY slots.ordinality
  `, [userId])
  return result.rows.map((row) => ({
    slot: String(row.slot),
    label: slotLabels[String(row.slot)] ?? String(row.slot),
    module: row.instance_id ? moduleDto(row as Record<string, unknown>) : null,
  }))
}

async function getStore(client: DbClient, userId: string) {
  const result = await client.query(`
    SELECT o.id AS offer_id, o.expires_at, o.price_snapshot, o.min_level_snapshot,
           d.id AS definition_id, d.sku, d.name, d.slot::text, d.family::text, d.rarity::text,
           d.power, d.shield, d.description,
           current.original_price_coins AS current_price
      FROM store_offers o
      JOIN store_rotations r ON r.id = o.rotation_id
      JOIN module_definitions d ON d.id = o.module_definition_id
      LEFT JOIN LATERAL (
        SELECT i.original_price_coins FROM user_module_instances i
         WHERE i.user_id = r.user_id AND i.slot = d.slot AND i.state = 'equipped' AND i.energy > 0
         LIMIT 1
      ) current ON true
     WHERE r.user_id = $1 AND r.status = 'active' AND r.ends_at > now()
       AND o.purchased_at IS NULL AND o.expires_at > now()
     ORDER BY o.created_at, o.id
  `, [userId])
  return result.rows.map((row) => {
    const price = Number(row.price_snapshot)
    const tradeInValue = row.current_price ? Math.floor(Number(row.current_price) * 0.5) : 0
    return {
      id: String(row.offer_id),
      expiresAt: (row.expires_at as Date).toISOString(),
      netCost: Math.max(0, price - tradeInValue),
      tradeInValue,
      minLevel: Number(row.min_level_snapshot),
      module: {
        definitionId: String(row.definition_id),
        slot: String(row.slot),
        slotLabel: slotLabels[String(row.slot)] ?? String(row.slot),
        name: String(row.name),
        family: String(row.family),
        rarity: String(row.rarity),
        power: Number(row.power),
        shield: Number(row.shield),
        energy: 100,
        state: 'equipped',
        priceCoins: price,
        description: String(row.description),
        descriptionKey: `module.${String(row.sku)}.description`,
      },
    }
  })
}

async function getHistory(client: DbClient, userId: string) {
  const [purchases, repairs, rewards] = await Promise.all([
    client.query<{ id: string; module_name: string; net_cost: string; created_at: Date }>(`
      SELECT e.id, d.name AS module_name, e.net_cost::text, e.created_at
      FROM module_purchase_events e JOIN user_module_instances i ON i.id = e.new_instance_id
      JOIN module_definitions d ON d.id = i.definition_id
      WHERE e.user_id = $1 ORDER BY e.created_at DESC LIMIT 30
    `, [userId]),
    client.query<{ id: string; module_name: string; repair_cost: string; energy_before: number; created_at: Date }>(`
      SELECT e.id, d.name AS module_name, e.repair_cost::text, e.energy_before, e.created_at
      FROM module_repair_events e JOIN user_module_instances i ON i.id = e.module_instance_id
      JOIN module_definitions d ON d.id = i.definition_id
      WHERE e.user_id = $1 ORDER BY e.created_at DESC LIMIT 30
    `, [userId]),
    client.query<{ id: string; amount: string; created_at: Date }>(`
      SELECT id, amount::text, created_at FROM synthcoin_ledger
      WHERE user_id = $1 AND type IN ('budget_reward', 'adjustment')
      ORDER BY created_at DESC LIMIT 30
    `, [userId]),
  ])
  return [
    ...purchases.rows.map((row) => ({ id: row.id, type: 'purchase', title: { key: 'game.history.purchaseTitle', params: { name: row.module_name } }, detail: { key: 'game.history.purchaseDetail' }, amount: -Number(row.net_cost), occurredAt: row.created_at.toISOString() })),
    ...repairs.rows.map((row) => ({ id: row.id, type: 'repair', title: { key: 'game.history.repairTitle', params: { name: row.module_name } }, detail: { key: 'game.history.repairDetail', params: { energy: row.energy_before } }, amount: -Number(row.repair_cost), occurredAt: row.created_at.toISOString() })),
    ...rewards.rows.map((row) => ({ id: row.id, type: 'reward', title: { key: 'game.history.rewardTitle' }, detail: { key: 'game.history.rewardDetail' }, amount: Number(row.amount), occurredAt: row.created_at.toISOString() })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 40)
}

async function getGameData(client: DbClient, userId: string) {
  const [progress, slots, offers, history, familyBonuses] = await Promise.all([
    getProgressSummary(client, userId), getCyberdeck(client, userId), getStore(client, userId), getHistory(client, userId), getFamilyBonuses(client, userId),
  ])
  return { progress, slots, offers, history, familyBonuses }
}

function mutationKey(request: AppRequest) {
  const parsed = z.string().uuid().safeParse(request.header('idempotency-key'))
  if (!parsed.success) throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'La cabecera Idempotency-Key debe contener un UUID.')
  return parsed.data
}

async function replay(client: DbClient, userId: string, scope: string, key: string) {
  const result = await client.query<{ response_status: number; response_body: unknown }>(
    'SELECT response_status, response_body FROM idempotency_records WHERE user_id = $1 AND scope = $2 AND idempotency_key = $3',
    [userId, scope, key],
  )
  return result.rows[0]
}

async function remember(client: DbClient, userId: string, scope: string, key: string, status: number, body: unknown) {
  await client.query(`
    INSERT INTO idempotency_records (user_id, scope, idempotency_key, response_status, response_body)
    VALUES ($1, $2, $3, $4, $5)
  `, [userId, scope, key, status, body])
}

export const gameRouter = Router()
gameRouter.use(requireAuth)

gameRouter.get('/summary', asyncHandler(async (request, response) => {
  response.json({ data: await getProgressSummary(pool, (request as AppRequest).userId), meta: {} })
}))
gameRouter.get('/cyberdeck', asyncHandler(async (request, response) => {
  response.json({ data: await getCyberdeck(pool, (request as AppRequest).userId), meta: {} })
}))
gameRouter.get('/store', asyncHandler(async (request, response) => {
  response.json({ data: await getStore(pool, (request as AppRequest).userId), meta: {} })
}))
gameRouter.get('/history', asyncHandler(async (request, response) => {
  response.json({ data: await getHistory(pool, (request as AppRequest).userId), meta: {} })
}))
gameRouter.get('/family-bonuses', asyncHandler(async (request, response) => {
  response.json({ data: await getFamilyBonuses(pool, (request as AppRequest).userId), meta: {} })
}))

gameRouter.post('/store/offers/:offerId/purchase', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const key = mutationKey(appRequest)
  const scope = `game:purchase:${request.params.offerId}`
  const result = await withTransaction(async (client) => {
    const previous = await replay(client, userId, scope, key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    const progressResult = await client.query<{ level: number; synthcoin_balance: string }>('SELECT level, synthcoin_balance FROM user_progress WHERE user_id = $1 FOR UPDATE', [userId])
    const progress = progressResult.rows[0]
    if (!progress) throw new ApiError(404, 'PROGRESS_NOT_FOUND', 'No se ha encontrado la progresión.')
    const penalty = await client.query('SELECT 1 FROM budget_penalties WHERE user_id = $1 AND active = true AND ends_at > now() LIMIT 1', [userId])
    if (penalty.rowCount) throw new ApiError(403, 'PURCHASES_LOCKED', 'Las compras están bloqueadas temporalmente.')
    const offerResult = await client.query<{
      offer_id: string; purchased_at: Date | null; expires_at: Date; rotation_status: string; rotation_ends_at: Date;
      definition_id: string; slot: string; name: string; family: string; rarity: string; power: number; shield: number;
      description: string; price_snapshot: string; min_level_snapshot: number;
    }>(`
      SELECT o.id AS offer_id, o.purchased_at, o.expires_at, r.status AS rotation_status, r.ends_at AS rotation_ends_at,
             d.id AS definition_id, d.sku, d.slot::text, d.name, d.family::text, d.rarity::text, d.power, d.shield,
             d.description, o.price_snapshot::text, o.min_level_snapshot
      FROM store_offers o JOIN store_rotations r ON r.id = o.rotation_id
      JOIN module_definitions d ON d.id = o.module_definition_id
      WHERE o.id = $1 AND r.user_id = $2 FOR UPDATE OF o
    `, [request.params.offerId, userId])
    const offer = offerResult.rows[0]
    if (!offer) throw new ApiError(404, 'OFFER_NOT_FOUND', 'No se ha encontrado la oferta.')
    if (offer.purchased_at) throw new ApiError(409, 'OFFER_ALREADY_PURCHASED', 'La oferta ya fue comprada.')
    if (offer.rotation_status !== 'active' || offer.expires_at.getTime() <= Date.now() || offer.rotation_ends_at.getTime() <= Date.now()) throw new ApiError(409, 'OFFER_EXPIRED', 'La oferta ha expirado.')
    if (progress.level < offer.min_level_snapshot) throw new ApiError(422, 'LEVEL_TOO_LOW', 'Tu nivel no permite adquirir esta mejora.')

    const currentResult = await client.query<{ id: string; original_price_coins: string }>(`
      SELECT id, original_price_coins::text FROM user_module_instances
      WHERE user_id = $1 AND slot = $2::module_slot AND state = 'equipped' FOR UPDATE
    `, [userId, offer.slot])
    const current = currentResult.rows[0]
    const newPrice = Number(offer.price_snapshot)
    const tradeInValue = current ? Math.floor(Number(current.original_price_coins) * 0.5) : 0
    const netCost = Math.max(0, newPrice - tradeInValue)
    const balanceBefore = Number(progress.synthcoin_balance)
    if (balanceBefore < netCost) throw new ApiError(422, 'INSUFFICIENT_SYNTHCOINS', 'No tienes SynthCoins suficientes.')
    const balanceAfter = balanceBefore - netCost
    await client.query('UPDATE user_progress SET synthcoin_balance = $2, updated_at = now() WHERE user_id = $1', [userId, balanceAfter])
    if (current) await client.query("UPDATE user_module_instances SET state = 'replaced', replaced_at = now() WHERE id = $1", [current.id])
    const instanceResult = await client.query<{ id: string }>(`
      INSERT INTO user_module_instances (user_id, definition_id, slot, original_price_coins, power_snapshot, shield_snapshot, energy, state)
      VALUES ($1, $2, $3::module_slot, $4, $5, $6, 100, 'equipped') RETURNING id
    `, [userId, offer.definition_id, offer.slot, newPrice, offer.power, offer.shield])
    const instanceId = instanceResult.rows[0]?.id
    if (!instanceId) throw new Error('Module instance insert failed')
    await client.query('UPDATE store_offers SET purchased_at = now() WHERE id = $1', [offer.offer_id])
    const eventResult = await client.query<{ id: string }>(`
      INSERT INTO module_purchase_events (user_id, offer_id, new_instance_id, replaced_instance_id, new_price, trade_in_value, net_cost, balance_before, balance_after, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
    `, [userId, offer.offer_id, instanceId, current?.id ?? null, newPrice, tradeInValue, netCost, balanceBefore, balanceAfter, key])
    const eventId = eventResult.rows[0]?.id
    await client.query(`
      INSERT INTO synthcoin_ledger (user_id, type, amount, balance_after, module_instance_id, reference_id, idempotency_key, metadata)
      VALUES ($1, 'purchase', $2, $3, $4, $5, $6, jsonb_build_object('offerId', $7::text))
    `, [userId, -netCost, balanceAfter, instanceId, eventId, key, offer.offer_id])
    const updatedProgress = await recalculateProgress(client, userId, 'module.purchase', eventId)
    await client.query(`
      INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'module.purchased', 'user_module_instance', $2, $3, jsonb_build_object('netCost', $4::int))
    `, [userId, instanceId, appRequest.requestId, netCost])
    const body = { data: { netCost, tradeInValue, balanceAfter, progress: updatedProgress, game: await getGameData(client, userId) }, meta: {} }
    await remember(client, userId, scope, key, 200, body)
    return { status: 200, body }
  })
  response.status(result.status).json(result.body)
}))

gameRouter.post('/modules/:instanceId/repair', asyncHandler(async (request, response) => {
  const appRequest = request as AppRequest
  const userId = appRequest.userId
  const key = mutationKey(appRequest)
  const scope = `game:repair:${request.params.instanceId}`
  const result = await withTransaction(async (client) => {
    const previous = await replay(client, userId, scope, key)
    if (previous) return { status: previous.response_status, body: previous.response_body }
    const progressResult = await client.query<{ synthcoin_balance: string }>('SELECT synthcoin_balance FROM user_progress WHERE user_id = $1 FOR UPDATE', [userId])
    const progress = progressResult.rows[0]
    if (!progress) throw new ApiError(404, 'PROGRESS_NOT_FOUND', 'No se ha encontrado la progresión.')
    const moduleResult = await client.query<{ id: string; energy: number; state: string; original_price_coins: string }>(`
      SELECT id, energy, state::text, original_price_coins::text FROM user_module_instances
      WHERE id = $1 AND user_id = $2 FOR UPDATE
    `, [request.params.instanceId, userId])
    const module = moduleResult.rows[0]
    if (!module) throw new ApiError(404, 'MODULE_NOT_FOUND', 'No se ha encontrado el módulo.')
    if (module.state === 'destroyed' || module.energy === 0) throw new ApiError(422, 'MODULE_DESTROYED', 'Un módulo destruido no puede repararse.')
    if (module.state !== 'equipped' || module.energy >= 100) throw new ApiError(422, 'MODULE_NOT_DAMAGED', 'El módulo no necesita reparación.')
    const originalPrice = Number(module.original_price_coins)
    const repairCost = Math.ceil(originalPrice * (100 - module.energy) / 100)
    const balanceBefore = Number(progress.synthcoin_balance)
    if (balanceBefore < repairCost) throw new ApiError(422, 'INSUFFICIENT_SYNTHCOINS', 'No tienes SynthCoins suficientes.')
    const balanceAfter = balanceBefore - repairCost
    await client.query('UPDATE user_progress SET synthcoin_balance = $2, updated_at = now() WHERE user_id = $1', [userId, balanceAfter])
    await client.query('UPDATE user_module_instances SET energy = 100 WHERE id = $1', [module.id])
    const eventResult = await client.query<{ id: string }>(`
      INSERT INTO module_repair_events (user_id, module_instance_id, energy_before, energy_after, damage_percent_bp, original_price, repair_cost, balance_before, balance_after, idempotency_key)
      VALUES ($1,$2,$3,100,$4,$5,$6,$7,$8,$9) RETURNING id
    `, [userId, module.id, module.energy, (100 - module.energy) * 100, originalPrice, repairCost, balanceBefore, balanceAfter, key])
    const eventId = eventResult.rows[0]?.id
    await client.query(`
      INSERT INTO synthcoin_ledger (user_id, type, amount, balance_after, module_instance_id, reference_id, idempotency_key, metadata)
      VALUES ($1, 'repair', $2, $3, $4, $5, $6, jsonb_build_object('energyBefore', $7::int))
    `, [userId, -repairCost, balanceAfter, module.id, eventId, key, module.energy])
    await client.query(`
      INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'user', 'module.repaired', 'user_module_instance', $2, $3, jsonb_build_object('repairCost', $4::int))
    `, [userId, module.id, appRequest.requestId, repairCost])
    const body = { data: { repairCost, balanceAfter, game: await getGameData(client, userId) }, meta: {} }
    await remember(client, userId, scope, key, 200, body)
    return { status: 200, body }
  })
  response.status(result.status).json(result.body)
}))

export { getGameData }
