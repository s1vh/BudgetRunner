import type { DbClient } from './db.js'

interface ProgressRow {
  level: number
  base_flux: number
  active_power: number
  family_bonus_power: number
  total_flux: number
  synthcoin_balance: string
  weekly_streak: number
  monthly_streak: number
  current_level_flux: number
  next_level_flux: number
  purchases_locked_until: Date | null
}

export async function getProgressSummary(client: DbClient, userId: string) {
  const { rows } = await client.query<ProgressRow>(`
    SELECT p.level, p.base_flux, p.active_power, p.family_bonus_power, p.total_flux,
           p.synthcoin_balance, p.weekly_streak, p.monthly_streak,
           current_level.required_flux AS current_level_flux,
           COALESCE(next_level.required_flux, current_level.required_flux + 500) AS next_level_flux,
           (SELECT max(ends_at) FROM budget_penalties
             WHERE user_id = p.user_id AND active = true AND ends_at > now()) AS purchases_locked_until
      FROM user_progress p
      JOIN level_thresholds current_level ON current_level.level = p.level
      LEFT JOIN LATERAL (
        SELECT required_flux FROM level_thresholds
         WHERE level = p.level + 1
         LIMIT 1
      ) next_level ON true
     WHERE p.user_id = $1
  `, [userId])
  const row = rows[0]
  if (!row) throw new Error('Progress row missing')
  return {
    level: row.level,
    baseFlux: row.base_flux,
    activePower: row.active_power,
    familyBonusPower: row.family_bonus_power,
    totalFlux: row.total_flux,
    currentLevelFlux: row.current_level_flux,
    nextLevelFlux: row.next_level_flux,
    synthcoins: Number(row.synthcoin_balance),
    weeklyStreak: row.weekly_streak,
    monthlyStreak: row.monthly_streak,
    ...(row.purchases_locked_until ? { purchasesLockedUntil: row.purchases_locked_until.toISOString() } : {}),
  }
}

export async function getFamilyBonuses(client: DbClient, userId: string) {
  const { rows } = await client.query<{ family: string; count: string; power: string }>(`
    SELECT d.family::text AS family, count(*)::text AS count,
           coalesce(sum(i.power_snapshot), 0)::text AS power
      FROM user_module_instances i
      JOIN module_definitions d ON d.id = i.definition_id
     WHERE i.user_id = $1 AND i.state = 'equipped' AND i.energy > 0
     GROUP BY d.family
     ORDER BY d.family
  `, [userId])
  const rules = (await client.query<{ minimum_count: number; bonus_percent_bp: number }>(
    'SELECT minimum_count, bonus_percent_bp FROM family_bonus_rules ORDER BY minimum_count DESC',
  )).rows

  return rows.map((row) => {
    const count = Number(row.count)
    const power = Number(row.power)
    const rule = rules.find((candidate) => count >= candidate.minimum_count)
    return { family: row.family, count, power, bonus: Math.trunc(power * (rule?.bonus_percent_bp ?? 0) / 10_000) }
  })
}

export async function recalculateProgress(client: DbClient, userId: string, reason: string, referenceId?: string) {
  const before = await client.query<{ level: number; base_flux: number }>(
    'SELECT level, base_flux FROM user_progress WHERE user_id = $1 FOR UPDATE',
    [userId],
  )
  const current = before.rows[0]
  if (!current) throw new Error('Progress row missing')

  const bonuses = await getFamilyBonuses(client, userId)
  const activePower = bonuses.reduce((sum, family) => sum + family.power, 0)
  const familyBonusPower = bonuses.reduce((sum, family) => sum + family.bonus, 0)
  const totalFlux = current.base_flux + activePower + familyBonusPower
  const threshold = await client.query<{ level: number }>(
    'SELECT level FROM level_thresholds WHERE required_flux <= $1 ORDER BY required_flux DESC LIMIT 1',
    [totalFlux],
  )
  const level = threshold.rows[0]?.level ?? 1

  await client.query(`
    UPDATE user_progress
       SET active_power = $2, family_bonus_power = $3, total_flux = $4, level = $5, updated_at = now()
     WHERE user_id = $1
  `, [userId, activePower, familyBonusPower, totalFlux, level])

  if (level !== current.level) {
    await client.query(`
      INSERT INTO level_history (user_id, old_level, new_level, total_flux, reason, reference_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, current.level, level, totalFlux, reason, referenceId ?? null])
  }
  return getProgressSummary(client, userId)
}

