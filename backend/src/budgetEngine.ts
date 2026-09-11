import { randomUUID } from 'node:crypto'
import {
  nextFuturePeriodStart,
  nextPeriodEndDate,
  renewalAnchorDate,
  type BudgetFrequency,
} from './budgetCalendar.js'
import type { DbClient } from './db.js'
import { pool, withTransaction } from './db.js'
import { ApiError } from './errors.js'
import { recalculateProgress } from './progress.js'

export type BudgetScope = 'global' | 'category'
export type BudgetLifecycleStatus = 'scheduled' | 'active' | 'paused' | 'archived'

const INT32_MAX = 2_147_483_647n
const INT64_MAX = 9_223_372_036_854_775_807n

function clampInt32(value: bigint) {
  return Number(value > INT32_MAX ? INT32_MAX : value)
}

export interface BudgetTemplateRow {
  id: string
  user_id: string
  frequency: BudgetFrequency
  scope: BudgetScope
  category_id: string | null
  status: BudgetLifecycleStatus
  limit_minor: string
  currency: string
  starts_on: string | Date
  timezone_snapshot: string
}

interface PeriodEvaluationRow extends BudgetTemplateRow {
  period_id: string
  starts_at: Date
  ends_at: Date
  period_status: 'open' | 'processing' | 'met' | 'exceeded' | 'closed' | 'cancelled'
  period_timezone: string
  frequency_snapshot: BudgetFrequency
  scope_snapshot: BudgetScope
  category_id_snapshot: string | null
  limit_minor_snapshot: string
  currency_snapshot: string
}

interface PeriodBounds {
  startsAt: Date
  endsAt: Date
}

interface CreatedPeriod extends PeriodBounds {
  id: string
}

function isoDate(value: string | Date) {
  // node-postgres materializes DATE as local midnight. UTC serialization can
  // shift it to the previous day in positive-offset server timezones.
  if (value instanceof Date) {
    return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  return value.slice(0, 10)
}

async function instantForLocalDate(client: DbClient, localDate: string, timezone: string) {
  const result = await client.query<{ instant: Date }>(
    'SELECT ($1::date::timestamp AT TIME ZONE $2) AS instant',
    [localDate, timezone],
  )
  const instant = result.rows[0]?.instant
  if (!instant) throw new Error('Could not calculate local date boundary')
  return instant
}

async function localDateAt(client: DbClient, instant: Date | null, timezone: string) {
  const result = await client.query<{ local_date: string }>(
    'SELECT (coalesce($1::timestamptz, now()) AT TIME ZONE $2)::date::text AS local_date',
    [instant, timezone],
  )
  const localDate = result.rows[0]?.local_date
  if (!localDate) throw new Error('Could not calculate current local date')
  return localDate
}

async function initialPeriodBounds(
  client: DbClient,
  startDate: string,
  frequency: BudgetFrequency,
  timezone: string,
  anchorDate: string,
): Promise<PeriodBounds> {
  const endDate = nextPeriodEndDate(startDate, frequency, anchorDate)
  const [startsAt, endsAt] = await Promise.all([
    instantForLocalDate(client, startDate, timezone),
    instantForLocalDate(client, endDate, timezone),
  ])
  if (endsAt <= startsAt) throw new Error('Budget period end must follow its start')
  return { startsAt, endsAt }
}

async function followingPeriodBounds(
  client: DbClient,
  previousEnd: Date,
  frequency: BudgetFrequency,
  timezone: string,
  anchorDate: string,
): Promise<PeriodBounds> {
  const localStart = await localDateAt(client, previousEnd, timezone)
  let localEnd = nextPeriodEndDate(localStart, frequency, anchorDate)
  let endsAt = await instantForLocalDate(client, localEnd, timezone)
  // A large timezone change can place the previous instant after midnight of
  // the derived local date. Keep the periods contiguous and advance if needed.
  if (endsAt <= previousEnd) {
    localEnd = nextPeriodEndDate(localEnd, frequency, anchorDate)
    endsAt = await instantForLocalDate(client, localEnd, timezone)
  }
  return { startsAt: previousEnd, endsAt }
}

async function insertPeriod(
  client: DbClient,
  budget: BudgetTemplateRow,
  bounds: PeriodBounds,
  timezone: string,
): Promise<CreatedPeriod> {
  const inserted = await client.query<{ id: string; starts_at: Date; ends_at: Date }>(`
    INSERT INTO budget_periods (
      budget_id, user_id, starts_at, ends_at, timezone_snapshot,
      frequency_snapshot, scope_snapshot, category_id_snapshot,
      limit_minor_snapshot, currency_snapshot
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (budget_id, starts_at, ends_at) DO NOTHING
    RETURNING id, starts_at, ends_at
  `, [
    budget.id, budget.user_id, bounds.startsAt, bounds.endsAt, timezone,
    budget.frequency, budget.scope, budget.category_id, budget.limit_minor, budget.currency,
  ])
  const created = inserted.rows[0]
  if (created) return { id: created.id, startsAt: created.starts_at, endsAt: created.ends_at }

  const existing = await client.query<{ id: string; starts_at: Date; ends_at: Date }>(`
    SELECT id, starts_at, ends_at FROM budget_periods
     WHERE budget_id = $1 AND starts_at = $2 AND ends_at = $3
  `, [budget.id, bounds.startsAt, bounds.endsAt])
  const row = existing.rows[0]
  if (!row) throw new Error('Budget period insert failed')
  return { id: row.id, startsAt: row.starts_at, endsAt: row.ends_at }
}

export async function createBudgetPeriod(client: DbClient, budget: BudgetTemplateRow, startsOn: string) {
  const anchorDate = isoDate(budget.starts_on)
  const bounds = await initialPeriodBounds(client, startsOn, budget.frequency, budget.timezone_snapshot, anchorDate)
  return insertPeriod(client, budget, bounds, budget.timezone_snapshot)
}

async function createNextBudgetPeriod(client: DbClient, period: PeriodEvaluationRow) {
  const user = await client.query<{ timezone: string }>('SELECT timezone FROM users WHERE id = $1', [period.user_id])
  const timezone = user.rows[0]?.timezone ?? period.timezone_snapshot
  const boundaryLocalDate = await localDateAt(client, period.ends_at, timezone)
  const anchorDate = renewalAnchorDate(
    period.frequency_snapshot,
    period.frequency,
    isoDate(period.starts_on),
    boundaryLocalDate,
  )
  const bounds = await followingPeriodBounds(
    client,
    period.ends_at,
    period.frequency,
    timezone,
    anchorDate,
  )
  const next = await insertPeriod(client, period, bounds, timezone)
  await client.query(`
    UPDATE budgets
       SET timezone_snapshot = $2,
           starts_on = $3,
           status = CASE WHEN $4 <= now() THEN 'active'::budget_status ELSE 'scheduled'::budget_status END
     WHERE id = $1 AND status IN ('active', 'scheduled')
  `, [period.id, timezone, anchorDate, next.startsAt])
  return next
}

export async function createResumedBudgetPeriod(client: DbClient, budget: BudgetTemplateRow) {
  const user = await client.query<{ timezone: string }>('SELECT timezone FROM users WHERE id = $1', [budget.user_id])
  const timezone = user.rows[0]?.timezone ?? budget.timezone_snapshot
  const latest = await client.query<{ ends_at: Date; frequency_snapshot: BudgetFrequency }>(`
    SELECT ends_at, frequency_snapshot::text
      FROM budget_periods
     WHERE budget_id = $1
     ORDER BY starts_at DESC
     LIMIT 1
  `, [budget.id])
  const previous = latest.rows[0]
  const currentLocalDate = await localDateAt(client, null, timezone)
  const previousBoundary = previous ? await localDateAt(client, previous.ends_at, timezone) : isoDate(budget.starts_on)
  const anchorDate = previous
    ? renewalAnchorDate(previous.frequency_snapshot, budget.frequency, isoDate(budget.starts_on), previousBoundary)
    : isoDate(budget.starts_on)
  const startsOn = nextFuturePeriodStart(anchorDate, budget.frequency, currentLocalDate)
  const resumed = { ...budget, starts_on: anchorDate, timezone_snapshot: timezone }
  const period = await createBudgetPeriod(client, resumed, startsOn)
  await client.query(`
    UPDATE budgets SET timezone_snapshot = $2, starts_on = $3, status = 'scheduled'
     WHERE id = $1 AND status = 'paused'
  `, [budget.id, timezone, anchorDate])
  return period
}

function rewardCoins(eligibleSurplusMinor: number) {
  return Math.floor(eligibleSurplusMinor / 100)
}

async function evaluatePeriodInTransaction(client: DbClient, periodId: string, requestId: string, force: boolean) {
  const owner = await client.query<{ user_id: string }>('SELECT user_id FROM budget_periods WHERE id = $1', [periodId])
  const userId = owner.rows[0]?.user_id
  if (!userId) throw new ApiError(404, 'BUDGET_PERIOD_NOT_FOUND', 'No se ha encontrado el periodo.')

  // All economic closes for one user share this lock. It makes overlap reward
  // priority deterministic even when multiple workers receive the same tick.
  await client.query('SELECT user_id FROM user_progress WHERE user_id = $1 FOR UPDATE', [userId])
  const locked = await client.query<PeriodEvaluationRow>(`
    SELECT p.id AS period_id, p.starts_at, p.ends_at, p.status::text AS period_status,
           p.timezone_snapshot AS period_timezone,
           p.frequency_snapshot::text, p.scope_snapshot::text, p.category_id_snapshot,
           p.limit_minor_snapshot::text, p.currency_snapshot,
           b.id, b.user_id, b.frequency::text, b.scope::text, b.category_id,
           b.status::text, b.limit_minor::text, b.currency, b.starts_on::text, b.timezone_snapshot
      FROM budget_periods p
      JOIN budgets b ON b.id = p.budget_id AND b.user_id = p.user_id
     WHERE p.id = $1
     FOR UPDATE OF p, b
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
  const transactions = await client.query<{
    id: string
    type: 'expense'
    concept: string
    amount_minor: string
    currency: string
    occurred_at: Date
    category_id: string | null
    category_name: string | null
    adjusts_transaction_id: string | null
  }>(`
    SELECT t.id,
           t.type::text,
           t.concept,
           t.amount_minor::text,
           t.currency,
           t.occurred_at,
           t.category_id,
           category.name AS category_name,
           t.adjusts_transaction_id
      FROM financial_transactions t
      LEFT JOIN categories category
        ON category.id = t.category_id AND category.user_id = t.user_id
     WHERE t.user_id = $1
       AND t.type = 'expense'
       AND t.status = 'posted'
       AND t.currency = $2
       AND t.occurred_at >= $3
       AND t.occurred_at < $4
       AND ($5::budget_scope = 'global' OR t.category_id = $6)
     ORDER BY t.occurred_at, t.id
     FOR UPDATE OF t
  `, [
    userId,
    period.currency_snapshot,
    period.starts_at,
    period.ends_at,
    period.scope_snapshot,
    period.category_id_snapshot,
  ])

  for (const transaction of transactions.rows) {
    await client.query(`
      INSERT INTO budget_period_transactions (
        user_id, period_id, transaction_id, source_transaction_id,
        type_snapshot, concept_snapshot, amount_minor_snapshot,
        currency_snapshot, occurred_at_snapshot, category_id_snapshot,
        category_name_snapshot, adjusts_transaction_id_snapshot, counted_minor
      )
      VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $6)
      ON CONFLICT (period_id, transaction_id) DO NOTHING
    `, [
      userId,
      periodId,
      transaction.id,
      transaction.type,
      transaction.concept,
      transaction.amount_minor,
      transaction.currency,
      transaction.occurred_at,
      transaction.category_id,
      transaction.category_name,
      transaction.adjusts_transaction_id,
    ])
  }

  const spendMinorExact = transactions.rows.reduce((sum, item) => sum + BigInt(item.amount_minor), 0n)
  if (spendMinorExact > INT64_MAX) {
    throw new ApiError(
      409,
      'BUDGET_PERIOD_TOTAL_OUT_OF_RANGE',
      'El gasto agregado del periodo excede el rango monetario admitido.',
    )
  }
  const limitMinorExact = BigInt(period.limit_minor_snapshot)
  const met = spendMinorExact <= limitMinorExact
  // A met total cannot exceed the API's safe-integer budget limit, so reward
  // allocation arithmetic remains exact as Number after the BigInt comparison.
  const surplusMinor = met ? Number(limitMinorExact - spendMinorExact) : 0
  const allocated = met && transactions.rows.length > 0
    ? await client.query<{ transaction_id: string; allocated_minor: string }>(`
        SELECT transaction_id, coalesce(sum(allocated_minor), 0)::text AS allocated_minor
          FROM reward_allocations
         WHERE transaction_id = ANY($1::uuid[]) AND period_id <> $2
         GROUP BY transaction_id
  `, [transactions.rows.map((item) => item.id), periodId])
    : { rows: [] }
  const previouslyAllocated = new Map(allocated.rows.map((item) => [item.transaction_id, Number(item.allocated_minor)]))
  const availableAllocationMinor = transactions.rows.reduce((sum, transaction) => (
    sum + Math.max(0, Number(transaction.amount_minor) - (previouslyAllocated.get(transaction.id) ?? 0))
  ), 0)
  // Every rewarded minor must be represented in reward_allocations. This cap
  // prevents low/zero-spend budgets from minting an untracked surplus that an
  // overlapping period could reward again.
  const traceableSurplusMinor = met ? Math.min(surplusMinor, availableAllocationMinor) : 0
  // SynthCoins are whole units (100 minor units). Keep sub-unit residue in the
  // excluded amount so the allocation ledger and awarded balance agree exactly.
  const eligibleSurplusMinor = Math.floor(traceableSurplusMinor / 100) * 100
  const excludedRewardMinor = Math.max(0, surplusMinor - eligibleSurplusMinor)
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
      await client.query(`
        INSERT INTO reward_allocations
          (user_id, period_id, transaction_id, allocated_minor, allocation_order)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, periodId, transaction.id, portion, allocationOrder])
      allocationRemaining -= portion
      allocationOrder += 1
    }

    if (transactions.rows.length > 0) {
      // A met close rewards Flux/streak state even when its monetary surplus is
      // zero or below one SynthCoin. Every counted expense is therefore part of
      // immutable rewarded history and must be corrected via an adjustment.
      await client.query(`
        UPDATE financial_transactions
           SET locked_by_reward = true
         WHERE user_id = $1 AND id = ANY($2::uuid[])
      `, [userId, transactions.rows.map((transaction) => transaction.id)])
    }

    synthcoinsAwarded = rewardCoins(eligibleSurplusMinor)
    fluxAwarded = period.frequency_snapshot === 'weekly' ? 25 : 100
    const progress = await client.query<{ synthcoin_balance: string; base_flux: number }>(
      'SELECT synthcoin_balance::text, base_flux FROM user_progress WHERE user_id = $1',
      [userId],
    )
    const before = progress.rows[0]
    if (!before) throw new Error('Progress row missing')
    const balanceAfter = (BigInt(before.synthcoin_balance) + BigInt(synthcoinsAwarded)).toString()
    const baseFluxAfter = before.base_flux + fluxAwarded
    await client.query(`
      UPDATE user_progress
         SET synthcoin_balance = $2,
             base_flux = $3,
             weekly_streak = CASE WHEN $4::budget_frequency = 'weekly' THEN weekly_streak + 1 ELSE weekly_streak END,
             monthly_streak = CASE WHEN $4::budget_frequency = 'monthly' THEN monthly_streak + 1 ELSE monthly_streak END,
             updated_at = now()
       WHERE user_id = $1
    `, [userId, balanceAfter, baseFluxAfter, period.frequency_snapshot])
    if (synthcoinsAwarded > 0) {
      await client.query(`
        INSERT INTO synthcoin_ledger
          (user_id, type, amount, balance_after, period_id, idempotency_key, metadata)
        VALUES ($1, 'budget_reward', $2, $3, $4, $5,
          jsonb_build_object('eligibleSurplusMinor', $6::bigint))
      `, [userId, synthcoinsAwarded, balanceAfter, periodId, randomUUID(), eligibleSurplusMinor])
    }
    await client.query(`
      INSERT INTO flux_ledger
        (user_id, type, amount, base_flux_after, period_id, idempotency_key, metadata)
      VALUES ($1, 'budget_completion', $2, $3, $4, $5,
        jsonb_build_object('frequency', $6::text))
    `, [userId, fluxAwarded, baseFluxAfter, periodId, randomUUID(), period.frequency_snapshot])
  } else {
    excessPercentBp = clampInt32((spendMinorExact - limitMinorExact) * 10_000n / limitMinorExact)
    baseDamage = clampInt32(100n * spendMinorExact / limitMinorExact)
    await client.query(`
      UPDATE user_progress
         SET weekly_streak = CASE WHEN $2::budget_frequency = 'weekly' THEN 0 ELSE weekly_streak END,
             monthly_streak = CASE WHEN $2::budget_frequency = 'monthly' THEN 0 ELSE monthly_streak END,
             updated_at = now()
       WHERE user_id = $1
    `, [userId, period.frequency_snapshot])
    const damage = await client.query<{ id: string }>(`
      INSERT INTO damage_events (user_id, period_id, base_damage, idempotency_key)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [userId, periodId, baseDamage, randomUUID()])
    const damageId = damage.rows[0]?.id
    if (!damageId) throw new Error('Damage event insert failed')
    const modules = await client.query<{ id: string; shield_snapshot: number; energy: number }>(`
      SELECT id, shield_snapshot, energy
        FROM user_module_instances
       WHERE user_id = $1 AND state = 'equipped'
       ORDER BY slot
       FOR UPDATE
    `, [userId])
    for (const module of modules.rows) {
      const applied = Math.max(0, Math.trunc(baseDamage - module.shield_snapshot * 10))
      const energyAfter = Math.max(0, module.energy - applied)
      const destroyed = energyAfter === 0
      await client.query(`
        UPDATE user_module_instances
           SET energy = $2,
               state = CASE WHEN $3 THEN 'destroyed'::module_state ELSE state END,
               destroyed_at = CASE WHEN $3 THEN now() ELSE destroyed_at END
         WHERE id = $1
      `, [module.id, energyAfter, destroyed])
      await client.query(`
        INSERT INTO module_damage_events
          (user_id, damage_event_id, module_instance_id, shield_snapshot, energy_before, damage_applied, energy_after, destroyed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [userId, damageId, module.id, module.shield_snapshot, module.energy, applied, energyAfter, destroyed])
    }
  }

  const renews = period.status === 'active' || period.status === 'scheduled'
  const next = renews ? await createNextBudgetPeriod(client, period) : null
  if (!met) {
    await client.query(`
      INSERT INTO budget_penalties (user_id, period_id, starts_at, ends_at)
      VALUES (
        $1,
        $2,
        now(),
        greatest(
          coalesce($3::timestamptz, '-infinity'::timestamptz),
          now() + ($4::timestamptz - $5::timestamptz)
        )
      )
      ON CONFLICT (period_id) WHERE period_id IS NOT NULL DO NOTHING
    `, [userId, periodId, next?.endsAt ?? null, period.ends_at, period.starts_at])
  }

  const closeKey = randomUUID()
  await client.query(`
    UPDATE budget_periods
       SET status = $2::period_status,
           spend_minor = $3,
           surplus_minor = $4,
           eligible_surplus_minor = $5,
           excluded_reward_minor = $6,
           synthcoins_awarded = $7,
           flux_awarded = $8,
           excess_percent_bp = $9,
           base_damage = $10,
           evaluated_at = now(),
           idempotency_key = $11
     WHERE id = $1
  `, [
    periodId,
    met ? 'met' : 'exceeded',
    spendMinorExact.toString(),
    surplusMinor,
    eligibleSurplusMinor,
    excludedRewardMinor,
    synthcoinsAwarded,
    fluxAwarded,
    excessPercentBp,
    baseDamage,
    closeKey,
  ])
  await recalculateProgress(client, userId, met ? 'budget.completed' : 'budget.damage', periodId)
  await client.query(`
    INSERT INTO audit_events
      (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
    VALUES ($1, 'system', $2, 'budget_period', $3, $4,
      jsonb_build_object(
        'spendMinor', $5::bigint,
        'limitMinor', $6::bigint,
        'synthcoins', $7::bigint,
        'flux', $8::int
      ))
  `, [
    userId,
    met ? 'budget.period_met' : 'budget.period_exceeded',
    periodId,
    requestId,
    spendMinorExact.toString(),
    limitMinorExact.toString(),
    synthcoinsAwarded,
    fluxAwarded,
  ])
  return { periodId, status: met ? 'met' : 'exceeded', evaluated: true }
}

export async function evaluateBudgetPeriod(
  periodId: string,
  options: { requestId?: string; force?: boolean } = {},
) {
  const requestId = options.requestId ?? randomUUID()
  return withTransaction((client) => evaluatePeriodInTransaction(client, periodId, requestId, options.force === true))
}

async function nextDueBudgetPeriod(userId?: string, excludedPeriodIds: string[] = []) {
  const due = await pool.query<{ id: string }>(`
    SELECT p.id
      FROM budget_periods p
      JOIN budgets b ON b.id = p.budget_id
     WHERE p.status = 'open'
       AND p.ends_at <= now()
       AND ($1::uuid IS NULL OR p.user_id = $1)
       AND NOT (p.id = ANY($2::uuid[]))
     ORDER BY p.ends_at,
              CASE p.frequency_snapshot WHEN 'weekly' THEN 0 ELSE 1 END,
              CASE p.scope_snapshot WHEN 'category' THEN 0 ELSE 1 END,
              b.created_at,
              p.id
     LIMIT 1
  `, [userId ?? null, excludedPeriodIds])
  return due.rows[0]
}

/**
 * Closes a specific due period without letting the maintenance endpoint bypass
 * overlap priority. Any earlier due period for the same user is evaluated
 * first using the same canonical order as the batch job.
 */
export async function evaluateDueBudgetPeriod(periodId: string, options: { requestId?: string } = {}) {
  const target = await pool.query<{ user_id: string; status: string; ends_at: Date }>(`
    SELECT user_id, status::text, ends_at
      FROM budget_periods
     WHERE id = $1
  `, [periodId])
  const period = target.rows[0]
  if (!period) throw new ApiError(404, 'BUDGET_PERIOD_NOT_FOUND', 'No se ha encontrado el periodo.')
  if (['met', 'exceeded', 'closed', 'cancelled'].includes(period.status)) {
    return { periodId, status: period.status, evaluated: false }
  }
  if (period.ends_at.getTime() > Date.now()) {
    throw new ApiError(409, 'BUDGET_PERIOD_NOT_DUE', 'El periodo todavía no ha finalizado.')
  }

  const requestId = options.requestId ?? randomUUID()
  // The creation API forbids historical starts, so this guard is far beyond a
  // normal backlog while still preventing a malformed legacy row from holding
  // one HTTP request indefinitely.
  for (let index = 0; index < 1_000; index += 1) {
    const due = await nextDueBudgetPeriod(period.user_id)
    if (!due) {
      // A concurrent worker may have completed the target between reads.
      return evaluateBudgetPeriod(periodId, { requestId })
    }
    const result = await evaluateBudgetPeriod(due.id, { requestId })
    if (due.id === periodId) return result
  }
  throw new ApiError(
    409,
    'BUDGET_PERIOD_PREDECESSORS_PENDING',
    'Hay demasiados periodos anteriores pendientes para evaluar este periodo individualmente.',
  )
}

export async function closeDueBudgetPeriods(
  options: { userId?: string; limit?: number; requestId?: string } = {},
) {
  const results: Array<{
    periodId: string
    status: string
    evaluated: boolean
    errorCode?: string
  }> = []
  const attemptedPeriodIds: string[] = []
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100)
  for (let index = 0; index < limit; index += 1) {
    const period = await nextDueBudgetPeriod(options.userId, attemptedPeriodIds)
    if (!period) break
    attemptedPeriodIds.push(period.id)
    try {
      results.push(await evaluateBudgetPeriod(period.id, options.requestId ? { requestId: options.requestId } : {}))
    } catch (error) {
      results.push({
        periodId: period.id,
        status: 'error',
        evaluated: false,
        errorCode: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
      })
    }
  }
  return results
}

export async function activateDueBudgets(userId: string) {
  await pool.query(`
    UPDATE budgets b
       SET status = 'active'
     WHERE b.user_id = $1
       AND b.status = 'scheduled'
       AND EXISTS (
         SELECT 1 FROM budget_periods p
          WHERE p.budget_id = b.id AND p.status = 'open' AND p.starts_at <= now()
       )
  `, [userId])
}
