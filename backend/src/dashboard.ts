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
  }
}

export async function getDashboard(client: DbClient, userId: string) {
  const [userResult, totalsResult, distributionResult, cashflowResult, recentResult, progress, criticalResult, offerResult] = await Promise.all([
    client.query<{ display_name: string; primary_currency: string }>(
      'SELECT display_name, primary_currency FROM users WHERE id = $1 AND deleted_at IS NULL', [userId],
    ),
    client.query<{ income: string; expenses: string }>(`
      SELECT coalesce(sum(amount_minor) FILTER (WHERE type = 'income'), 0)::text AS income,
             coalesce(sum(amount_minor) FILTER (WHERE type = 'expense'), 0)::text AS expenses
        FROM financial_transactions
       WHERE user_id = $1 AND status = 'posted' AND occurred_at <= now()
    `, [userId]),
    client.query<{ category: string; amount_minor: string; color: string; icon_key: string | null; is_system_seed: boolean | null }>(`
      SELECT coalesce(c.name, 'Otros') AS category,
             sum(t.amount_minor)::text AS amount_minor,
             coalesce(c.color_token, '#986780') AS color,
             c.icon_key,
             c.is_system_seed
        FROM financial_transactions t
        LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
       WHERE t.user_id = $1 AND t.type = 'expense' AND t.status = 'posted' AND t.occurred_at <= now()
       GROUP BY c.name, c.color_token, c.icon_key, c.is_system_seed
       ORDER BY sum(t.amount_minor) DESC
       LIMIT 5
    `, [userId]),
    client.query<{ month_key: string; income_minor: string; expense_minor: string }>(`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '6 months',
          date_trunc('month', now()), interval '1 month'
        ) AS month_start
      )
      SELECT to_char(month_start, 'YYYY-MM') AS month_key,
             coalesce(sum(t.amount_minor) FILTER (WHERE t.type = 'income'), 0)::text AS income_minor,
             coalesce(sum(t.amount_minor) FILTER (WHERE t.type = 'expense'), 0)::text AS expense_minor
        FROM months
        LEFT JOIN financial_transactions t ON t.user_id = $1 AND t.status = 'posted'
          AND t.occurred_at >= month_start AND t.occurred_at < month_start + interval '1 month'
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
  ])

  const user = userResult.rows[0]
  const totals = totalsResult.rows[0] ?? { income: '0', expenses: '0' }
  if (!user) throw new Error('User not found')
  const totalExpenses = distributionResult.rows.reduce((sum, row) => sum + Number(row.amount_minor), 0)
  const alerts: Array<{ id: string; tone: 'info' | 'warning' | 'critical'; message: { key: string; params: Record<string, string | number> } }> = []
  const critical = criticalResult.rows[0]
  if (critical) alerts.push({ id: 'critical-module', tone: 'warning', message: { key: 'alert.criticalModule', params: { name: critical.name, energy: critical.energy } } })
  const offerExpiry = offerResult.rows[0]?.expires_at
  if (offerExpiry) {
    const days = Math.max(0, Math.ceil((offerExpiry.getTime() - Date.now()) / 86_400_000))
    alerts.push({ id: 'store-rotation', tone: 'info', message: { key: days === 1 ? 'alert.storeRotation.one' : 'alert.storeRotation.other', params: { days } } })
  }

  return {
    displayName: user.display_name,
    systemStatus: 'dashboard.systemOnline',
    balanceMinor: Number(totals.income) - Number(totals.expenses),
    budgetRemainingMinor: 0,
    currency: user.primary_currency,
    distribution: distributionResult.rows.map((row) => ({
      category: row.category,
      ...(row.icon_key && systemCategoryKey(row.icon_key, Boolean(row.is_system_seed)) ? { systemKey: systemCategoryKey(row.icon_key, Boolean(row.is_system_seed)) } : {}),
      amountMinor: Number(row.amount_minor),
      percentage: totalExpenses > 0 ? Math.round(Number(row.amount_minor) / totalExpenses * 100) : 0,
      color: row.color,
    })),
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
