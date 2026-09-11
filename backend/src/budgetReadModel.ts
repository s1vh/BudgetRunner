import type { DbClient } from './db.js'
import { ApiError } from './errors.js'

interface BudgetRow {
  id: string
  name: string
  period_id: string
  frequency: string
  scope: string
  category_id: string | null
  category_name: string | null
  limit_minor: string
  currency: string
  timezone: string
  budget_status: string
  period_status: string
  starts_at: Date
  ends_at: Date
  spend_minor: string
  surplus_minor: string
  eligible_surplus_minor: string
  excluded_reward_minor: string
  synthcoins_awarded: string
  flux_awarded: number
  configured_frequency: string
  configured_scope: string
  configured_category_id: string | null
  configured_category_name: string | null
  configured_limit_minor: string
  configured_currency: string
  configured_timezone: string
}

function budgetDto(row: BudgetRow) {
  const status = row.budget_status === 'paused' || row.budget_status === 'archived'
    ? row.budget_status
    : row.period_status === 'met' || row.period_status === 'exceeded'
      ? row.period_status
      : row.starts_at.getTime() > Date.now() ? 'scheduled' : 'active'
  return {
    id: row.id,
    periodId: row.period_id,
    name: row.name,
    frequency: row.frequency,
    scope: row.scope,
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    ...(row.category_name ? { categoryName: row.category_name } : {}),
    limitMinor: Number(row.limit_minor),
    spendMinor: Number(row.spend_minor),
    eligibleSurplusMinor: Number(row.eligible_surplus_minor),
    excludedRewardMinor: Number(row.excluded_reward_minor),
    currency: row.currency,
    timezone: row.timezone,
    status,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    synthcoinsAwarded: Number(row.synthcoins_awarded),
    fluxAwarded: row.flux_awarded,
    configuredFrequency: row.configured_frequency,
    configuredScope: row.configured_scope,
    ...(row.configured_category_id ? { configuredCategoryId: row.configured_category_id } : {}),
    ...(row.configured_category_name ? { configuredCategoryName: row.configured_category_name } : {}),
    configuredLimitMinor: Number(row.configured_limit_minor),
    configuredCurrency: row.configured_currency,
    configuredTimezone: row.configured_timezone,
  }
}

export async function getBudgets(client: DbClient, userId: string, budgetId?: string) {
  const result = await client.query<BudgetRow>(`
    SELECT b.id,
           b.name,
           p.id AS period_id,
           p.frequency_snapshot::text AS frequency,
           p.scope_snapshot::text AS scope,
           p.category_id_snapshot AS category_id,
           current_category.name AS category_name,
           p.limit_minor_snapshot::text AS limit_minor,
           p.currency_snapshot AS currency,
           p.timezone_snapshot AS timezone,
           b.status::text AS budget_status,
           p.status::text AS period_status,
           p.starts_at,
           p.ends_at,
           CASE WHEN p.status = 'open' THEN live.spend_minor ELSE p.spend_minor END::text AS spend_minor,
           CASE
             WHEN p.status = 'open' AND p.starts_at > now() THEN 0
             WHEN p.status = 'open' THEN greatest(0, p.limit_minor_snapshot - live.spend_minor)
             ELSE p.surplus_minor
           END::text AS surplus_minor,
           CASE
             WHEN p.status = 'open' AND p.starts_at > now() THEN 0
             WHEN p.status = 'open' THEN
               floor(least(
                 greatest(0, p.limit_minor_snapshot - live.spend_minor),
                 live.available_allocation_minor
               )::numeric / 100)::bigint * 100
             ELSE p.eligible_surplus_minor
           END::text AS eligible_surplus_minor,
           CASE
             WHEN p.status = 'open' AND p.starts_at > now() THEN 0
             WHEN p.status = 'open' THEN greatest(0, p.limit_minor_snapshot - live.spend_minor) -
               floor(least(
                 greatest(0, p.limit_minor_snapshot - live.spend_minor),
                 live.available_allocation_minor
               )::numeric / 100)::bigint * 100
             ELSE p.excluded_reward_minor
           END::text AS excluded_reward_minor,
           p.synthcoins_awarded::text,
           p.flux_awarded,
           b.frequency::text AS configured_frequency,
           b.scope::text AS configured_scope,
           b.category_id AS configured_category_id,
           configured_category.name AS configured_category_name,
           b.limit_minor::text AS configured_limit_minor,
           b.currency AS configured_currency,
           b.timezone_snapshot AS configured_timezone
      FROM budgets b
      JOIN LATERAL (
        SELECT period.*
          FROM budget_periods period
         WHERE period.budget_id = b.id
         ORDER BY CASE WHEN period.status = 'open' THEN 0 ELSE 1 END,
                  period.starts_at DESC
         LIMIT 1
      ) p ON true
      LEFT JOIN categories current_category
        ON current_category.id = p.category_id_snapshot AND current_category.user_id = b.user_id
      LEFT JOIN categories configured_category
        ON configured_category.id = b.category_id AND configured_category.user_id = b.user_id
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(t.amount_minor), 0)::bigint AS spend_minor,
               coalesce(sum(greatest(0, t.amount_minor - (
                 SELECT coalesce(sum(allocation.allocated_minor), 0)
                   FROM reward_allocations allocation
                  WHERE allocation.transaction_id = t.id AND allocation.period_id <> p.id
               ))), 0)::bigint AS available_allocation_minor
          FROM financial_transactions t
         WHERE t.user_id = b.user_id
           AND t.type = 'expense'
           AND t.status = 'posted'
           AND t.currency = p.currency_snapshot
           AND t.occurred_at >= p.starts_at
           AND t.occurred_at < p.ends_at
           AND t.occurred_at <= now()
           AND (p.scope_snapshot = 'global' OR t.category_id = p.category_id_snapshot)
      ) live ON true
     WHERE b.user_id = $1 AND ($2::uuid IS NULL OR b.id = $2)
     ORDER BY CASE b.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,
              p.ends_at,
              b.created_at
  `, [userId, budgetId ?? null])
  return result.rows.map(budgetDto)
}

interface PeriodRow {
  id: string
  budget_id: string
  starts_at: Date
  ends_at: Date
  status: string
  frequency: string
  scope: string
  category_id: string | null
  category_name: string | null
  timezone: string
  limit_minor: string
  currency: string
  spend_minor: string
  surplus_minor: string
  eligible_surplus_minor: string
  excluded_reward_minor: string
  synthcoins_awarded: string
  flux_awarded: number
  excess_percent_bp: number
  base_damage: number
  evaluated_at: Date | null
}

function periodDto(row: PeriodRow) {
  return {
    id: row.id,
    budgetId: row.budget_id,
    status: row.status,
    frequency: row.frequency,
    scope: row.scope,
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    ...(row.category_name ? { categoryName: row.category_name } : {}),
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    timezone: row.timezone,
    limitMinor: Number(row.limit_minor),
    currency: row.currency,
    spendMinor: Number(row.spend_minor),
    surplusMinor: Number(row.surplus_minor),
    eligibleSurplusMinor: Number(row.eligible_surplus_minor),
    excludedRewardMinor: Number(row.excluded_reward_minor),
    synthcoinsAwarded: Number(row.synthcoins_awarded),
    fluxAwarded: row.flux_awarded,
    excessPercentBp: row.excess_percent_bp,
    baseDamage: row.base_damage,
    evaluatedAt: row.evaluated_at?.toISOString() ?? null,
  }
}

export async function getBudgetPeriods(client: DbClient, userId: string, budgetId: string, periodId?: string) {
  const result = await client.query<PeriodRow>(`
    SELECT p.id,
           p.budget_id,
           p.starts_at,
           p.ends_at,
           p.status::text,
           p.frequency_snapshot::text AS frequency,
           p.scope_snapshot::text AS scope,
           p.category_id_snapshot AS category_id,
           category.name AS category_name,
           p.timezone_snapshot AS timezone,
           p.limit_minor_snapshot::text AS limit_minor,
           p.currency_snapshot AS currency,
           CASE WHEN p.status = 'open' THEN live.spend_minor ELSE p.spend_minor END::text AS spend_minor,
           CASE
             WHEN p.status = 'open' AND p.starts_at > now() THEN 0
             WHEN p.status = 'open' THEN greatest(0, p.limit_minor_snapshot - live.spend_minor)
             ELSE p.surplus_minor
           END::text AS surplus_minor,
           CASE
             WHEN p.status = 'open' AND p.starts_at > now() THEN 0
             WHEN p.status = 'open' THEN
               floor(least(
                 greatest(0, p.limit_minor_snapshot - live.spend_minor),
                 live.available_allocation_minor
               )::numeric / 100)::bigint * 100
             ELSE p.eligible_surplus_minor
           END::text AS eligible_surplus_minor,
           CASE
             WHEN p.status = 'open' AND p.starts_at > now() THEN 0
             WHEN p.status = 'open' THEN greatest(0, p.limit_minor_snapshot - live.spend_minor) -
               floor(least(
                 greatest(0, p.limit_minor_snapshot - live.spend_minor),
                 live.available_allocation_minor
               )::numeric / 100)::bigint * 100
             ELSE p.excluded_reward_minor
           END::text AS excluded_reward_minor,
           p.synthcoins_awarded::text,
           p.flux_awarded,
           p.excess_percent_bp,
           p.base_damage,
           p.evaluated_at
      FROM budget_periods p
      JOIN budgets b ON b.id = p.budget_id AND b.user_id = p.user_id
      LEFT JOIN categories category
        ON category.id = p.category_id_snapshot AND category.user_id = p.user_id
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(t.amount_minor), 0)::bigint AS spend_minor,
               coalesce(sum(greatest(0, t.amount_minor - (
                 SELECT coalesce(sum(allocation.allocated_minor), 0)
                   FROM reward_allocations allocation
                  WHERE allocation.transaction_id = t.id AND allocation.period_id <> p.id
               ))), 0)::bigint AS available_allocation_minor
          FROM financial_transactions t
         WHERE t.user_id = p.user_id
           AND t.type = 'expense'
           AND t.status = 'posted'
           AND t.currency = p.currency_snapshot
           AND t.occurred_at >= p.starts_at
           AND t.occurred_at < p.ends_at
           AND t.occurred_at <= now()
           AND (p.scope_snapshot = 'global' OR t.category_id = p.category_id_snapshot)
      ) live ON true
     WHERE b.id = $1 AND b.user_id = $2 AND ($3::uuid IS NULL OR p.id = $3)
     ORDER BY p.starts_at DESC
  `, [budgetId, userId, periodId ?? null])
  return result.rows.map(periodDto)
}

interface PeriodIdentityRow extends PeriodRow {
  budget_name: string
  user_id: string
}

interface PeriodTransactionRow {
  id: string
  type: string
  concept: string
  amount_minor: string
  counted_minor: string
  allocated_minor: string
  currency: string
  occurred_at: Date
  category_id: string | null
  category_name: string | null
  adjusts_transaction_id: string | null
}

function periodTransactionDto(row: PeriodTransactionRow) {
  return {
    id: row.id,
    type: row.type,
    concept: row.concept,
    amountMinor: Number(row.amount_minor),
    countedMinor: Number(row.counted_minor),
    allocatedMinor: Number(row.allocated_minor),
    currency: row.currency,
    occurredAt: row.occurred_at.toISOString(),
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    ...(row.category_name ? { categoryName: row.category_name } : {}),
    ...(row.adjusts_transaction_id ? { adjustsTransactionId: row.adjusts_transaction_id } : {}),
  }
}

export async function getBudgetPeriodDetail(client: DbClient, userId: string, periodId: string) {
  const identity = await client.query<PeriodIdentityRow>(`
    SELECT p.id,
           p.budget_id,
           p.user_id,
           b.name AS budget_name,
           p.starts_at,
           p.ends_at,
           p.status::text,
           p.frequency_snapshot::text AS frequency,
           p.scope_snapshot::text AS scope,
           p.category_id_snapshot AS category_id,
           category.name AS category_name,
           p.timezone_snapshot AS timezone,
           p.limit_minor_snapshot::text AS limit_minor,
           p.currency_snapshot AS currency,
           p.spend_minor::text,
           p.surplus_minor::text,
           p.eligible_surplus_minor::text,
           p.excluded_reward_minor::text,
           p.synthcoins_awarded::text,
           p.flux_awarded,
           p.excess_percent_bp,
           p.base_damage,
           p.evaluated_at
      FROM budget_periods p
      JOIN budgets b ON b.id = p.budget_id AND b.user_id = p.user_id
      LEFT JOIN categories category
        ON category.id = p.category_id_snapshot AND category.user_id = p.user_id
     WHERE p.id = $1 AND p.user_id = $2
  `, [periodId, userId])
  const raw = identity.rows[0]
  if (!raw) throw new ApiError(404, 'BUDGET_PERIOD_NOT_FOUND', 'No se ha encontrado el periodo.')

  const summaries = await getBudgetPeriods(client, userId, raw.budget_id, periodId)
  const summary = summaries[0]
  if (!summary) throw new Error('Budget period summary missing')

  const transactions = raw.status === 'open' || raw.status === 'processing'
    ? await client.query<PeriodTransactionRow>(`
        SELECT t.id,
               t.type::text,
               t.concept,
               t.amount_minor::text,
               t.amount_minor::text AS counted_minor,
               coalesce((
                 SELECT sum(allocation.allocated_minor)
                   FROM reward_allocations allocation
                  WHERE allocation.period_id = $1 AND allocation.transaction_id = t.id
               ), 0)::text AS allocated_minor,
               t.currency,
               t.occurred_at,
               t.category_id,
               category.name AS category_name,
               t.adjusts_transaction_id
          FROM financial_transactions t
          LEFT JOIN categories category ON category.id = t.category_id AND category.user_id = t.user_id
         WHERE t.user_id = $2
           AND t.type = 'expense'
           AND t.status = 'posted'
           AND t.currency = $3
           AND t.occurred_at >= $4
           AND t.occurred_at < $5
           AND t.occurred_at <= now()
           AND ($6::budget_scope = 'global' OR t.category_id = $7)
         ORDER BY t.occurred_at, t.id
      `, [periodId, userId, raw.currency, raw.starts_at, raw.ends_at, raw.scope, raw.category_id])
    : await client.query<PeriodTransactionRow>(`
        SELECT snapshot.source_transaction_id AS id,
               snapshot.type_snapshot::text AS type,
               snapshot.concept_snapshot AS concept,
               snapshot.amount_minor_snapshot::text AS amount_minor,
               snapshot.counted_minor::text,
               coalesce((
                 SELECT sum(allocation.allocated_minor)
                   FROM reward_allocations allocation
                  WHERE allocation.period_id = $1
                    AND allocation.transaction_id = snapshot.transaction_id
               ), 0)::text AS allocated_minor,
               snapshot.currency_snapshot AS currency,
               snapshot.occurred_at_snapshot AS occurred_at,
               snapshot.category_id_snapshot AS category_id,
               snapshot.category_name_snapshot AS category_name,
               snapshot.adjusts_transaction_id_snapshot AS adjusts_transaction_id
          FROM budget_period_transactions snapshot
         WHERE snapshot.period_id = $1
         ORDER BY snapshot.occurred_at_snapshot, snapshot.source_transaction_id
      `, [periodId])

  const [penalty, damage] = await Promise.all([
    client.query<{ starts_at: Date; ends_at: Date; active: boolean }>(`
      SELECT starts_at, ends_at, active
        FROM budget_penalties
       WHERE period_id = $1
       LIMIT 1
    `, [periodId]),
    client.query<{ id: string; base_damage: number; created_at: Date }>(`
      SELECT id, base_damage, created_at
        FROM damage_events
       WHERE period_id = $1
       LIMIT 1
    `, [periodId]),
  ])
  const damageRow = damage.rows[0]
  const moduleDamage = damageRow
    ? await client.query<{
        module_instance_id: string
        module_name: string
        shield_snapshot: number
        energy_before: number
        damage_applied: number
        energy_after: number
        destroyed: boolean
      }>(`
        SELECT event.module_instance_id,
               definition.name AS module_name,
               event.shield_snapshot,
               event.energy_before,
               event.damage_applied,
               event.energy_after,
               event.destroyed
          FROM module_damage_events event
          JOIN user_module_instances instance ON instance.id = event.module_instance_id
          JOIN module_definitions definition ON definition.id = instance.definition_id
         WHERE event.damage_event_id = $1
         ORDER BY instance.slot
      `, [damageRow.id])
    : { rows: [] }
  const penaltyRow = penalty.rows[0]

  return {
    ...summary,
    budgetName: raw.budget_name,
    transactions: transactions.rows.map(periodTransactionDto),
    penalty: penaltyRow ? {
      startsAt: penaltyRow.starts_at.toISOString(),
      endsAt: penaltyRow.ends_at.toISOString(),
      active: penaltyRow.active && penaltyRow.ends_at.getTime() > Date.now(),
    } : null,
    damage: damageRow ? {
      baseDamage: damageRow.base_damage,
      occurredAt: damageRow.created_at.toISOString(),
      modules: moduleDamage.rows.map((row) => ({
        instanceId: row.module_instance_id,
        name: row.module_name,
        shield: row.shield_snapshot,
        energyBefore: row.energy_before,
        damageApplied: row.damage_applied,
        energyAfter: row.energy_after,
        destroyed: row.destroyed,
      })),
    } : null,
  }
}
