import { randomUUID } from 'node:crypto'
import type { DbClient } from './db.js'
import { pool, withTransaction } from './db.js'
import { ApiError } from './errors.js'
import { recalculateProgress } from './progress.js'
import { rotateStoreForPeriod } from './storeRotation.js'

interface BudgetRow {
  id: string
  user_id: string
  frequency: 'weekly' | 'monthly'
  status: 'scheduled' | 'active' | 'paused' | 'archived'
  limit_minor: string
  currency: string
  timezone_snapshot: string
}

interface PeriodRow extends BudgetRow {
  period_id: string
  starts_at: Date
  ends_at: Date
  period_status: string
  scope: 'global' | 'category'
  category_id: string | null
}

export async function createBudgetPeriod(client: DbClient, budget: BudgetRow, startsOn: string) {
  const bounds = await client.query<{ starts_at: Date; ends_at: Date }>(`
    SELECT ($1::date::timestamp AT TIME ZONE $3) AS starts_at,
           (CASE WHEN $2 = 'weekly'
                 THEN ($1::date + interval '7 days')::timestamp
                 ELSE ($1::date + interval '1 month')::timestamp
            END AT TIME ZONE $3) AS ends_at
  `, [startsOn, budget.frequency, budget.timezone_snapshot])
  const value = bounds.rows[0]
  if (!value) throw new Error('Could not calculate budget period bounds')
  const inserted = await client.query<{ id: string; starts_at: Date; ends_at: Date }>(`
    INSERT INTO budget_periods
      (budget_id, user_id, starts_at, ends_at, timezone_snapshot, limit_minor_snapshot, currency_snapshot)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (budget_id, starts_at, ends_at) DO UPDATE SET budget_id = EXCLUDED.budget_id
    RETURNING id, starts_at, ends_at
  `, [budget.id, budget.user_id, value.starts_at, value.ends_at, budget.timezone_snapshot, budget.limit_minor, budget.currency])
  const period = inserted.rows[0]
  if (!period) throw new Error('Budget period insert failed')
  return period
}

async function createNextBudgetPeriod(client: DbClient, period: PeriodRow) {
  const inserted = await client.query<{ id: string; starts_at: Date; ends_at: Date }>(`
    INSERT INTO budget_periods
      (budget_id, user_id, starts_at, ends_at, timezone_snapshot, limit_minor_snapshot, currency_snapshot)
    SELECT $1, $2, $3,
           ((($3 AT TIME ZONE $4) + CASE WHEN $5 = 'weekly' THEN interval '7 days' ELSE interval '1 month' END) AT TIME ZONE $4),
           $4, $6, $7
    ON CONFLICT (budget_id, starts_at, ends_at) DO UPDATE SET budget_id = EXCLUDED.budget_id
    RETURNING id, starts_at, ends_at
  `, [period.id, period.user_id, period.ends_at, period.timezone_snapshot, period.frequency, period.limit_minor, period.currency])
  const next = inserted.rows[0]
  if (!next) throw new Error('Next budget period insert failed')
  return next
}

function rewardCoins(eligibleSurplusMinor: number) {
  return Math.floor(eligibleSurplusMinor / 100)
}

async function evaluatePeriodInTransaction(client: DbClient, periodId: string, requestId: string, force: boolean) {
  const owner = await client.query<{ user_id: string }>('SELECT user_id FROM budget_periods WHERE id = $1', [periodId])
  const userId = owner.rows[0]?.user_id
  if (!userId) throw new ApiError(404, 'BUDGET_PERIOD_NOT_FOUND', 'No se ha encontrado el periodo.')
  await client.query('SELECT user_id FROM user_progress WHERE user_id = $1 FOR UPDATE', [userId])

  const locked = await client.query<PeriodRow>(`
    SELECT p.id AS period_id, p.starts_at, p.ends_at, p.status::text AS period_status,
           b.id, b.user_id, b.frequency::text, b.status::text, b.limit_minor::text,
           b.currency, b.timezone_snapshot, b.scope::text, b.category_id
      FROM budget_periods p JOIN budgets b ON b.id = p.budget_id
     WHERE p.id = $1 FOR UPDATE OF p, b
  `, [periodId])
  const period = locked.rows[0]
  if (!period) throw new ApiError(404, 'BUDGET_PERIOD_NOT_FOUND', 'No se ha encontrado el periodo.')
  if (['met', 'exceeded', 'closed', 'cancelled'].includes(period.period_status)) {
    return { periodId, status: period.period_status, evaluated: false }
  }
  if (!force && period.ends_at.getTime() > Date.now()) {
    throw new ApiError(409, 'BUDGET_PERIOD_NOT_DUE', 'El periodo todavía no ha finalizado.')
  }

  await client.query("UPDATE budget_periods SET status = 'processing' WHERE id = $1", [periodId])
  const transactions = await client.query<{ id: string; amount_minor: string }>(`
    SELECT t.id, t.amount_minor::text
      FROM financial_transactions t
     WHERE t.user_id = $1 AND t.type = 'expense' AND t.status = 'posted'
       AND t.currency = $2 AND t.occurred_at >= $3 AND t.occurred_at < $4
       AND ($5 = 'global' OR t.category_id = $6)
     ORDER BY t.occurred_at, t.id
     FOR UPDATE OF t
  `, [userId, period.currency, period.starts_at, period.ends_at, period.scope, period.category_id])

  for (const transaction of transactions.rows) {
    await client.query(`INSERT INTO budget_period_transactions (period_id, transaction_id, counted_minor)
      VALUES ($1, $2, $3) ON CONFLICT (period_id, transaction_id) DO NOTHING`,
    [periodId, transaction.id, transaction.amount_minor])
  }

  const spendMinor = transactions.rows.reduce((sum, item) => sum + Number(item.amount_minor), 0)
  const limitMinor = Number(period.limit_minor)
  const surplusMinor = Math.max(0, limitMinor - spendMinor)
  const allocated = transactions.rows.length ? await client.query<{ transaction_id: string; allocated_minor: string }>(`
    SELECT transaction_id, coalesce(sum(allocated_minor), 0)::text AS allocated_minor
      FROM reward_allocations
     WHERE transaction_id = ANY($1::uuid[]) AND period_id <> $2
     GROUP BY transaction_id
  `, [transactions.rows.map((item) => item.id), periodId]) : { rows: [] }
  const previouslyAllocated = new Map(allocated.rows.map((item) => [item.transaction_id, Number(item.allocated_minor)]))
  const excludedRewardMinor = Math.min(surplusMinor, [...previouslyAllocated.values()].reduce((sum, value) => sum + value, 0))
  const eligibleSurplusMinor = Math.max(0, surplusMinor - excludedRewardMinor)
  const met = spendMinor <= limitMinor
  const closeKey = randomUUID()
  let synthcoinsAwarded = 0
  let fluxAwarded = 0
  let excessPercentBp = 0
  let baseDamage = 0

  if (met) {
    let allocationRemaining = eligibleSurplusMinor
    let allocationOrder = 1
    for (const transaction of transactions.rows) {
      if (allocationRemaining <= 0) break
      const available = Math.max(0, Number(transaction.amount_minor) - (previouslyAllocated.get(transaction.id) ?? 0))
      const portion = Math.min(available, allocationRemaining)
      if (portion <= 0) continue
      await client.query(`INSERT INTO reward_allocations
        (user_id, period_id, transaction_id, allocated_minor, allocation_order)
        VALUES ($1, $2, $3, $4, $5)`, [userId, periodId, transaction.id, portion, allocationOrder])
      await client.query('UPDATE financial_transactions SET locked_by_reward = true WHERE id = $1', [transaction.id])
      allocationRemaining -= portion
      allocationOrder += 1
    }

    synthcoinsAwarded = rewardCoins(eligibleSurplusMinor)
    fluxAwarded = period.frequency === 'weekly' ? 25 : 100
    const progress = await client.query<{ synthcoin_balance: string; base_flux: number }>(
      'SELECT synthcoin_balance::text, base_flux FROM user_progress WHERE user_id = $1', [userId],
    )
    const before = progress.rows[0]
    if (!before) throw new Error('Progress row missing')
    const balanceAfter = Number(before.synthcoin_balance) + synthcoinsAwarded
    const baseFluxAfter = before.base_flux + fluxAwarded
    await client.query(`UPDATE user_progress
      SET synthcoin_balance = $2, base_flux = $3,
          weekly_streak = CASE WHEN $4 = 'weekly' THEN weekly_streak + 1 ELSE weekly_streak END,
          monthly_streak = CASE WHEN $4 = 'monthly' THEN monthly_streak + 1 ELSE monthly_streak END,
          updated_at = now()
      WHERE user_id = $1`, [userId, balanceAfter, baseFluxAfter, period.frequency])
    await client.query(`INSERT INTO synthcoin_ledger
      (user_id, type, amount, balance_after, period_id, idempotency_key, metadata)
      VALUES ($1, 'budget_reward', $2, $3, $4, $5, jsonb_build_object('eligibleSurplusMinor', $6::bigint))`,
    [userId, synthcoinsAwarded, balanceAfter, periodId, randomUUID(), eligibleSurplusMinor])
    await client.query(`INSERT INTO flux_ledger
      (user_id, type, amount, base_flux_after, period_id, idempotency_key, metadata)
      VALUES ($1, 'budget_completion', $2, $3, $4, $5, jsonb_build_object('frequency', $6::text))`,
    [userId, fluxAwarded, baseFluxAfter, periodId, randomUUID(), period.frequency])
  } else {
    excessPercentBp = Math.floor((spendMinor - limitMinor) * 10_000 / limitMinor)
    baseDamage = Math.floor(100 * spendMinor / limitMinor)
    await client.query(`UPDATE user_progress
      SET weekly_streak = CASE WHEN $2 = 'weekly' THEN 0 ELSE weekly_streak END,
          monthly_streak = CASE WHEN $2 = 'monthly' THEN 0 ELSE monthly_streak END,
          updated_at = now() WHERE user_id = $1`, [userId, period.frequency])
    const damage = await client.query<{ id: string }>(`
      INSERT INTO damage_events (user_id, period_id, base_damage, idempotency_key)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [userId, periodId, baseDamage, randomUUID()])
    const damageId = damage.rows[0]?.id
    if (!damageId) throw new Error('Damage event insert failed')
    const modules = await client.query<{ id: string; shield_snapshot: number; energy: number }>(`
      SELECT id, shield_snapshot, energy FROM user_module_instances
       WHERE user_id = $1 AND state = 'equipped' ORDER BY slot FOR UPDATE
    `, [userId])
    for (const module of modules.rows) {
      const applied = Math.max(0, Math.trunc(baseDamage - module.shield_snapshot * 10))
      const energyAfter = Math.max(0, module.energy - applied)
      const destroyed = energyAfter === 0
      await client.query(`UPDATE user_module_instances SET energy = $2,
        state = CASE WHEN $3 THEN 'destroyed'::module_state ELSE state END,
        destroyed_at = CASE WHEN $3 THEN now() ELSE destroyed_at END WHERE id = $1`,
      [module.id, energyAfter, destroyed])
      await client.query(`INSERT INTO module_damage_events
        (damage_event_id, module_instance_id, shield_snapshot, energy_before, damage_applied, energy_after, destroyed)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [damageId, module.id, module.shield_snapshot, module.energy, applied, energyAfter, destroyed])
    }
  }

  const next = period.status === 'active' ? await createNextBudgetPeriod(client, period) : null
  if (next) await rotateStoreForPeriod(client, { userId, periodId: next.id, startsAt: next.starts_at, endsAt: next.ends_at })
  if (!met) {
    const fallbackEnd = new Date(Date.now() + Math.max(60_000, period.ends_at.getTime() - period.starts_at.getTime()))
    await client.query(`INSERT INTO budget_penalties (user_id, period_id, starts_at, ends_at)
      VALUES ($1, $2, now(), $3) ON CONFLICT (period_id) WHERE period_id IS NOT NULL DO NOTHING`,
    [userId, periodId, next?.ends_at ?? fallbackEnd])
  }

  await client.query(`UPDATE budget_periods SET status = $2::period_status, spend_minor = $3,
    surplus_minor = $4, eligible_surplus_minor = $5, excluded_reward_minor = $6,
    synthcoins_awarded = $7, flux_awarded = $8, excess_percent_bp = $9, base_damage = $10,
    evaluated_at = now(), idempotency_key = $11 WHERE id = $1`,
  [periodId, met ? 'met' : 'exceeded', spendMinor, surplusMinor, eligibleSurplusMinor,
    excludedRewardMinor, synthcoinsAwarded, fluxAwarded, excessPercentBp, baseDamage, closeKey])
  await recalculateProgress(client, userId, met ? 'budget.completed' : 'budget.damage', periodId)
  await client.query(`INSERT INTO audit_events
    (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
    VALUES ($1, 'system', $2, 'budget_period', $3, $4,
      jsonb_build_object('spendMinor', $5::bigint, 'limitMinor', $6::bigint, 'synthcoins', $7::bigint, 'flux', $8::int))`,
  [userId, met ? 'budget.period_met' : 'budget.period_exceeded', periodId, requestId, spendMinor, limitMinor, synthcoinsAwarded, fluxAwarded])
  return { periodId, status: met ? 'met' : 'exceeded', evaluated: true }
}

export async function evaluateBudgetPeriod(periodId: string, options: { requestId?: string; force?: boolean } = {}) {
  const requestId = options.requestId ?? randomUUID()
  return withTransaction((client) => evaluatePeriodInTransaction(client, periodId, requestId, options.force === true))
}

export async function closeDueBudgetPeriods(options: { userId?: string; limit?: number; requestId?: string } = {}) {
  const results = []
  const limit = options.limit ?? 25
  for (let index = 0; index < limit; index += 1) {
    const due = await pool.query<{ id: string }>(`
      SELECT p.id
        FROM budget_periods p JOIN budgets b ON b.id = p.budget_id
       WHERE p.status = 'open' AND p.ends_at <= now() AND ($1::uuid IS NULL OR p.user_id = $1)
       ORDER BY p.ends_at,
                CASE b.frequency WHEN 'weekly' THEN 0 ELSE 1 END,
                CASE b.scope WHEN 'category' THEN 0 ELSE 1 END,
                b.created_at, p.id
       LIMIT 1
    `, [options.userId ?? null])
    const period = due.rows[0]
    if (!period) break
    results.push(await evaluateBudgetPeriod(period.id, options.requestId ? { requestId: options.requestId } : {}))
  }
  return results
}

export async function activateDueBudgets(userId: string) {
  return withTransaction(async (client) => {
    await client.query(`UPDATE budgets b SET status = 'active'
      WHERE b.user_id = $1 AND b.status = 'scheduled'
        AND EXISTS (SELECT 1 FROM budget_periods p WHERE p.budget_id = b.id AND p.status = 'open' AND p.starts_at <= now())`, [userId])
    const latest = await client.query<{ id: string; starts_at: Date; ends_at: Date }>(`
      SELECT p.id, p.starts_at, p.ends_at FROM budget_periods p JOIN budgets b ON b.id = p.budget_id
       WHERE p.user_id = $1 AND p.status = 'open' AND p.starts_at <= now() AND b.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM store_rotations r WHERE r.source_period_id = p.id)
       ORDER BY p.starts_at DESC, p.ends_at ASC, p.id LIMIT 1
    `, [userId])
    const period = latest.rows[0]
    if (period) await rotateStoreForPeriod(client, { userId, periodId: period.id, startsAt: period.starts_at, endsAt: period.ends_at })
  })
}
