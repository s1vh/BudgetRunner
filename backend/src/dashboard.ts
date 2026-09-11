import type { DbClient } from './db.js'
import { getProgressSummary } from './progress.js'
import { systemCategoryKey } from './systemCategories.js'

function transactionDto(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    type: String(row.type),
    status: String(row.status),
    concept: String(row.concept),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    categoryId: row.category_id ? String(row.category_id) : '',
    categoryName: row.category_name ? String(row.category_name) : 'Otros',
    occurredAt: (row.occurred_at as Date).toISOString(),
    ...(row.notes ? { notes: String(row.notes) } : {}),
    lockedByReward: Boolean(row.locked_by_reward),
    ...(row.adjusts_transaction_id ? { adjustsTransactionId: String(row.adjusts_transaction_id) } : {}),
    ...(row.adjustment_reason ? { adjustmentReason: String(row.adjustment_reason) } : {}),
  }
}

function integerPercentages(amounts: number[], total: number) {
  if (total <= 0 || amounts.length === 0) return amounts.map(() => 0)
  const exact = amounts.map((amount) => amount / total * 100)
  const percentages = exact.map(Math.floor)
  let remaining = 100 - percentages.reduce((sum, value) => sum + value, 0)
  const remainderOrder = exact
    .map((value, index) => ({ index, remainder: value - percentages[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (const item of remainderOrder) {
    if (remaining <= 0) break
    percentages[item.index]! += 1
    remaining -= 1
  }
  return percentages
}

export async function getDashboard(client: DbClient, userId: string) {
  const [userResult, totalsResult, distributionResult, cashflowResult, recentResult, progress, criticalResult, offerResult, budgetResult] = await Promise.all([
    client.query<{ display_name: string; primary_currency: string; timezone: string }>(
      'SELECT display_name, primary_currency, timezone FROM users WHERE id = $1 AND deleted_at IS NULL', [userId],
    ),
    client.query<{ income: string; expenses: string }>(`
      SELECT coalesce(sum(tx.amount_minor) FILTER (WHERE tx.type = 'income'), 0)::text AS income,
             coalesce(sum(tx.amount_minor) FILTER (WHERE tx.type = 'expense'), 0)::text AS expenses
        FROM users owner
        LEFT JOIN financial_transactions tx
          ON tx.user_id = owner.id
         AND tx.status = 'posted'
         AND tx.occurred_at <= now()
         AND tx.currency = owner.primary_currency
       WHERE owner.id = $1 AND owner.deleted_at IS NULL
    `, [userId]),
    client.query<{
      category: string
      amount_minor: string
      total_minor: string
      color: string
      icon_key: string | null
      is_system_seed: boolean | null
    }>(`
      WITH settings AS (
        SELECT primary_currency,
               (date_trunc('month', now() AT TIME ZONE timezone) AT TIME ZONE timezone) AS starts_at,
               ((date_trunc('month', now() AT TIME ZONE timezone) + interval '1 month') AT TIME ZONE timezone) AS ends_at
          FROM users
         WHERE id = $1 AND deleted_at IS NULL
      ), distribution AS (
        SELECT coalesce(category.name, 'Otros') AS category,
               sum(tx.amount_minor) AS amount_minor,
               coalesce(category.color_token, '#986780') AS color,
               category.icon_key,
               category.is_system_seed
          FROM settings
          JOIN financial_transactions tx
            ON tx.user_id = $1
           AND tx.type = 'expense'
           AND tx.status = 'posted'
           AND tx.currency = settings.primary_currency
           AND tx.occurred_at >= settings.starts_at
           AND tx.occurred_at < settings.ends_at
           AND tx.occurred_at <= now()
         LEFT JOIN categories category
            ON category.id = tx.category_id AND category.user_id = tx.user_id
         GROUP BY category.name, category.color_token, category.icon_key, category.is_system_seed
      ), ranked AS (
        SELECT distribution.*,
               row_number() OVER (
                 ORDER BY CASE WHEN is_system_seed = true AND icon_key = 'shapes' THEN 1 ELSE 0 END,
                          amount_minor DESC,
                          category
               ) AS position
          FROM distribution
      ), bucketed AS (
        SELECT CASE WHEN position <= 4 THEN category ELSE 'Otros' END AS category,
               amount_minor,
               CASE WHEN position <= 4 THEN color ELSE '#986780' END AS color,
               CASE WHEN position <= 4 THEN icon_key ELSE 'shapes' END AS icon_key,
               CASE WHEN position <= 4 THEN is_system_seed ELSE true END AS is_system_seed,
               CASE WHEN position <= 4 THEN position ELSE 5 END AS position
          FROM ranked
      ), collapsed AS (
        SELECT category,
               sum(amount_minor) AS amount_minor,
               color,
               icon_key,
               is_system_seed,
               position
          FROM bucketed
         GROUP BY category, color, icon_key, is_system_seed, position
      )
      SELECT category,
             amount_minor::text,
             sum(amount_minor) OVER ()::text AS total_minor,
             color,
             icon_key,
             is_system_seed
        FROM collapsed
       ORDER BY position, amount_minor DESC
    `, [userId]),
    client.query<{ month_key: string; income_minor: string; expense_minor: string }>(`
      WITH settings AS (
        SELECT primary_currency,
               timezone,
               date_trunc('month', now() AT TIME ZONE timezone) AS current_month
          FROM users
         WHERE id = $1 AND deleted_at IS NULL
      ), months AS (
        SELECT generate_series(
                 settings.current_month - interval '6 months',
                 settings.current_month,
                 interval '1 month'
               ) AS month_start,
               settings.primary_currency,
               settings.timezone
          FROM settings
      )
      SELECT to_char(month_start, 'YYYY-MM') AS month_key,
             coalesce(sum(tx.amount_minor) FILTER (WHERE tx.type = 'income'), 0)::text AS income_minor,
             coalesce(sum(tx.amount_minor) FILTER (WHERE tx.type = 'expense'), 0)::text AS expense_minor
        FROM months
        LEFT JOIN financial_transactions tx
          ON tx.user_id = $1
         AND tx.status = 'posted'
         AND tx.currency = months.primary_currency
         AND tx.occurred_at >= (months.month_start AT TIME ZONE months.timezone)
         AND tx.occurred_at < ((months.month_start + interval '1 month') AT TIME ZONE months.timezone)
         AND tx.occurred_at <= now()
       GROUP BY month_start ORDER BY month_start
    `, [userId]),
    client.query(`
      SELECT t.*, c.name AS category_name
        FROM financial_transactions t
        LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
       WHERE t.user_id = $1
       ORDER BY t.occurred_at DESC, t.created_at DESC
       LIMIT 5
    `, [userId]),
    getProgressSummary(client, userId),
    client.query<{ name: string; energy: number }>(`
      SELECT d.name, i.energy FROM user_module_instances i
      JOIN module_definitions d ON d.id = i.definition_id
      WHERE i.user_id = $1 AND i.state = 'equipped' AND i.energy <= 25
      ORDER BY i.energy LIMIT 1
    `, [userId]),
    client.query<{ expires_at: Date }>(`
      SELECT min(o.expires_at) AS expires_at FROM store_offers o
      JOIN store_rotations r ON r.id = o.rotation_id
      WHERE r.user_id = $1 AND r.status = 'active' AND o.purchased_at IS NULL AND o.expires_at > now()
    `, [userId]),
    client.query<{ remaining_minor: string; next_close_at: Date | null }>(`
      SELECT coalesce(sum(greatest(0, period.limit_minor_snapshot - live.spend_minor)), 0)::text AS remaining_minor,
             min(period.ends_at) AS next_close_at
        FROM budgets budget
        JOIN users owner ON owner.id = budget.user_id
        JOIN LATERAL (
          SELECT candidate.*
            FROM budget_periods candidate
           WHERE candidate.budget_id = budget.id
             AND candidate.status = 'open'
             AND candidate.starts_at <= now()
             AND candidate.ends_at > now()
           ORDER BY candidate.starts_at DESC
           LIMIT 1
        ) period ON true
        LEFT JOIN LATERAL (
          SELECT coalesce(sum(tx.amount_minor), 0)::bigint AS spend_minor
            FROM financial_transactions tx
           WHERE tx.user_id = budget.user_id
             AND tx.type = 'expense'
             AND tx.status = 'posted'
             AND tx.currency = period.currency_snapshot
             AND tx.occurred_at >= period.starts_at
             AND tx.occurred_at < period.ends_at
             AND tx.occurred_at <= now()
             AND (period.scope_snapshot = 'global' OR tx.category_id = period.category_id_snapshot)
        ) live ON true
       WHERE budget.user_id = $1
         AND period.currency_snapshot = owner.primary_currency
    `, [userId]),
  ])

  const user = userResult.rows[0]
  const totals = totalsResult.rows[0] ?? { income: '0', expenses: '0' }
  if (!user) throw new Error('User not found')
  const totalExpenses = Number(distributionResult.rows[0]?.total_minor ?? 0)
  const alerts: Array<{ id: string; tone: 'info' | 'warning' | 'critical'; message: { key: string; params: Record<string, string | number> } }> = []
  const critical = criticalResult.rows[0]
  if (critical) alerts.push({ id: 'critical-module', tone: 'warning', message: { key: 'alert.criticalModule', params: { name: critical.name, energy: critical.energy } } })
  const offerExpiry = offerResult.rows[0]?.expires_at
  if (offerExpiry) {
    const days = Math.max(0, Math.ceil((offerExpiry.getTime() - Date.now()) / 86_400_000))
    alerts.push({ id: 'store-rotation', tone: 'info', message: { key: days === 1 ? 'alert.storeRotation.one' : 'alert.storeRotation.other', params: { days } } })
  }
  const percentages = integerPercentages(
    distributionResult.rows.map((row) => Number(row.amount_minor)),
    totalExpenses,
  )
  const distribution = distributionResult.rows.map((row, index) => {
    return {
      category: row.category,
      ...(row.icon_key && systemCategoryKey(row.icon_key, Boolean(row.is_system_seed)) ? { systemKey: systemCategoryKey(row.icon_key, Boolean(row.is_system_seed)) } : {}),
      amountMinor: Number(row.amount_minor),
      percentage: percentages[index] ?? 0,
      color: row.color,
    }
  })

  return {
    displayName: user.display_name,
    systemStatus: 'dashboard.systemOnline',
    balanceMinor: Number(totals.income) - Number(totals.expenses),
    budgetRemainingMinor: Number(budgetResult.rows[0]?.remaining_minor ?? 0),
    budgetNextCloseAt: budgetResult.rows[0]?.next_close_at?.toISOString() ?? null,
    currency: user.primary_currency,
    distribution,
    cashflow: cashflowResult.rows.map((row) => ({
      label: row.month_key,
      incomeMinor: Number(row.income_minor),
      expenseMinor: Number(row.expense_minor),
    })),
    recentTransactions: recentResult.rows.map((row) => transactionDto(row as Record<string, unknown>)),
    progress,
    alerts,
  }
}

export { transactionDto }
