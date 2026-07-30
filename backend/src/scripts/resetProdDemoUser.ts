import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, deleteApp, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import pg, { type QueryResult, type QueryResultRow } from 'pg'
import {
  buildProdDemoFixture,
  PROD_DEMO_EMAIL,
  PROD_DEMO_FIXTURE_VERSION,
  type ProdDemoFixture,
} from './prodDemoFixture.js'

const { Client } = pg
const DATABASE_URL_ENV = 'PROD_DEMO_DATABASE_URL'
const FIREBASE_PROJECT_ID_ENV = 'PROD_DEMO_FIREBASE_PROJECT_ID'
const SERVICE_ACCOUNT_PATH_ENV = 'GOOGLE_APPLICATION_CREDENTIALS'
const INTERNAL_UUID_FALLBACK_ENV = 'PROD_DEMO_INTERNAL_UUID'
const TEST_USER_FILE = fileURLToPath(new URL('../../../testuser.nfo', import.meta.url))
const CHECKPOINT_ACTION = 'prod_demo.identity_checkpoint'
const FALLBACK_FIREBASE_UID = 'budget-runner-demo-user'
const EXPECTED_FIREBASE_PROJECT_ID = 'budget-runner-cyberdeck'

interface SqlClient {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
}

interface DatabaseUser {
  id: string
  email: string
  firebase_uid: string | null
  deleted_at: Date | null
}

export interface TestCredentials {
  email: string
  password: string
}

interface IdentityCheckpoint {
  internalUserId: string
  firebaseUid: string | null
}

interface CanonicalIdentity {
  internalUserId: string
  firebaseUidHint: string | null
  existingDatabaseUser: DatabaseUser | null
  source: 'checkpoint' | 'database' | 'fallback'
}

interface FirebaseIdentityPlan {
  uid: string
  exists: boolean
  currentEmail: string | null
  replacementUid: string | null
}

export interface ResetOptions {
  mode: 'dry-run' | 'apply' | 'help'
}

export interface UserState {
  categories: number
  transactions: number
  budgets: number
  periods: number
  modules: number
  rotations: number
  offers: number
  activeOffers: number
  purchaseEvents: number
  repairEvents: number
  damageEvents: number
  levelHistory: number
  coinLedger: number
  fluxLedger: number
  rewardAllocations: number
}

interface ThresholdRow {
  level: number
  required_flux: number
}

interface FamilyRuleRow {
  minimum_count: number
  bonus_percent_bp: number
}

interface NormalizedProgress {
  level: number
  baseFlux: number
  activePower: number
  familyBonusPower: number
  totalFlux: number
  currentLevelFlux: number
  nextLevelFlux: number
}

function usage(email = PROD_DEMO_EMAIL) {
  return [
    'Reset manual de la identidad y los datos del usuario demo de producción.',
    '',
    `Vista previa: npm run prod:demo:reset -- --dry-run`,
    `Aplicar:       npm run prod:demo:reset -- --confirm ${email}`,
    '',
    `Credenciales demo: testuser.nfo`,
    `PostgreSQL: ${DATABASE_URL_ENV}`,
    `Firebase: ${FIREBASE_PROJECT_ID_ENV} + ${SERVICE_ACCOUNT_PATH_ENV}`,
  ].join('\n')
}

export function parseResetArgs(args: string[], expectedEmail = PROD_DEMO_EMAIL): ResetOptions {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return { mode: 'help' }
  if (args.length === 1 && args[0] === '--dry-run') return { mode: 'dry-run' }
  if (args.length === 2 && args[0] === '--confirm' && args[1] === expectedEmail) return { mode: 'apply' }
  throw new Error(`Argumentos no válidos.\n\n${usage(expectedEmail)}`)
}

export function parseTestUserNfo(contents: string): TestCredentials {
  const lines = contents.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const email = lines[0] ?? ''
  const password = lines[1] ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('testuser.nfo no contiene un email válido en la primera línea.')
  if (password.length < 6 || password.length > 128) throw new Error('testuser.nfo no contiene una contraseña Firebase válida en la segunda línea.')
  return { email: email.toLowerCase(), password }
}

async function readTestCredentials() {
  return parseTestUserNfo(await readFile(TEST_USER_FILE, 'utf8'))
}

function safeDatabaseLabel(connectionString: string) {
  const parsed = new URL(connectionString)
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${DATABASE_URL_ENV} must be a PostgreSQL URL.`)
  }
  const username = decodeURIComponent(parsed.username || 'unknown-user')
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, '') || 'unknown-database')
  return {
    label: `${username}@${parsed.hostname}/${database}`,
    pooled: parsed.hostname.includes('pooler'),
  }
}

function validUuid(value: string | undefined | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

async function readIdentityCheckpoint(client: SqlClient, email: string): Promise<IdentityCheckpoint | null> {
  const checkpoint = await client.query<{ entity_id: string; firebase_uid: string | null }>(`
    SELECT entity_id::text, metadata->>'firebaseUid' AS firebase_uid
      FROM audit_events
     WHERE action = $1
       AND entity_type = 'user'
       AND entity_id IS NOT NULL
     ORDER BY CASE WHEN metadata->>'credentialEmail' = $2 THEN 0 ELSE 1 END,
              created_at DESC
     LIMIT 1
  `, [CHECKPOINT_ACTION, email])
  if (checkpoint.rows[0]) {
    return {
      internalUserId: checkpoint.rows[0].entity_id,
      firebaseUid: checkpoint.rows[0].firebase_uid,
    }
  }
  const previousReset = await client.query<{ entity_id: string }>(`
    SELECT entity_id::text
      FROM audit_events
     WHERE action = 'prod_demo.reset'
       AND entity_type = 'user'
       AND entity_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1
  `)
  return previousReset.rows[0] ? { internalUserId: previousReset.rows[0].entity_id, firebaseUid: null } : null
}

async function findDatabaseUsers(client: SqlClient, internalUserId: string | null, email: string) {
  const result = await client.query<DatabaseUser>(`
    SELECT id, email::text, firebase_uid, deleted_at
      FROM users
     WHERE ($1::uuid IS NOT NULL AND id = $1)
        OR email = $2
     ORDER BY CASE WHEN id = $1::uuid THEN 0 ELSE 1 END
     LIMIT 2
  `, [internalUserId, email])
  return result.rows
}

async function resolveCanonicalIdentity(client: SqlClient, email: string): Promise<CanonicalIdentity> {
  const checkpoint = await readIdentityCheckpoint(client, email)
  if (checkpoint && !validUuid(checkpoint.internalUserId)) throw new Error('El checkpoint contiene un UUID interno no válido.')
  const databaseUsers = await findDatabaseUsers(client, checkpoint?.internalUserId ?? null, email)
  const canonicalDatabaseUser = checkpoint
    ? databaseUsers.find((candidate) => candidate.id === checkpoint.internalUserId) ?? null
    : databaseUsers[0] ?? null
  if (checkpoint?.firebaseUid && canonicalDatabaseUser?.firebase_uid && checkpoint.firebaseUid !== canonicalDatabaseUser.firebase_uid) {
    throw new Error('El UID Firebase de PostgreSQL no coincide con el checkpoint canónico.')
  }
  if (checkpoint) {
    return {
      internalUserId: checkpoint.internalUserId,
      firebaseUidHint: checkpoint.firebaseUid ?? canonicalDatabaseUser?.firebase_uid ?? null,
      existingDatabaseUser: canonicalDatabaseUser ?? databaseUsers[0] ?? null,
      source: 'checkpoint',
    }
  }
  if (canonicalDatabaseUser) {
    return {
      internalUserId: canonicalDatabaseUser.id,
      firebaseUidHint: canonicalDatabaseUser.firebase_uid,
      existingDatabaseUser: canonicalDatabaseUser,
      source: 'database',
    }
  }
  const fallback = process.env[INTERNAL_UUID_FALLBACK_ENV]?.trim()
  if (!validUuid(fallback)) {
    throw new Error(
      `La cuenta y su checkpoint no existen. Define ${INTERNAL_UUID_FALLBACK_ENV} con el UUID interno histórico para recrearla sin cambiar de identidad.`,
    )
  }
  return {
    internalUserId: fallback,
    firebaseUidHint: null,
    existingDatabaseUser: null,
    source: 'fallback',
  }
}

interface ServiceAccountFile {
  project_id?: string
  client_email?: string
  private_key?: string
}

async function initializeFirebaseAdmin() {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('FIREBASE_AUTH_EMULATOR_HOST debe estar vacío: este mantenimiento solo admite el proyecto live confirmado.')
  }
  const projectId = process.env[FIREBASE_PROJECT_ID_ENV]?.trim()
  const serviceAccountPath = process.env[SERVICE_ACCOUNT_PATH_ENV]?.trim()
  if (!projectId) throw new Error(`Falta ${FIREBASE_PROJECT_ID_ENV}.`)
  if (!serviceAccountPath) throw new Error(`Falta ${SERVICE_ACCOUNT_PATH_ENV}.`)
  if (projectId !== EXPECTED_FIREBASE_PROJECT_ID) {
    throw new Error(`${FIREBASE_PROJECT_ID_ENV} debe ser ${EXPECTED_FIREBASE_PROJECT_ID}.`)
  }
  let serviceAccount: ServiceAccountFile
  try {
    serviceAccount = JSON.parse(await readFile(resolve(serviceAccountPath), 'utf8')) as ServiceAccountFile
  } catch {
    throw new Error(`No se puede leer el JSON indicado por ${SERVICE_ACCOUNT_PATH_ENV}.`)
  }
  if (serviceAccount.project_id !== projectId) {
    throw new Error(`La cuenta de servicio pertenece a otro proyecto; se esperaba ${projectId}.`)
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('El JSON de la cuenta de servicio no contiene client_email/private_key.')
  }
  const app = initializeApp({
    projectId,
    credential: cert({
      projectId,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  }, 'budget-runner-prod-demo-reset')
  return { app, auth: getAuth(app), projectId }
}

function firebaseErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  return String(error.code)
}

async function optionalFirebaseUserByUid(auth: Auth, uid: string) {
  try {
    return await auth.getUser(uid)
  } catch (error) {
    if (firebaseErrorCode(error) === 'auth/user-not-found') return null
    throw error
  }
}

async function optionalFirebaseUserByEmail(auth: Auth, email: string) {
  try {
    return await auth.getUserByEmail(email)
  } catch (error) {
    if (firebaseErrorCode(error) === 'auth/user-not-found') return null
    throw error
  }
}

async function inspectFirebaseIdentity(auth: Auth, identity: CanonicalIdentity, email: string): Promise<FirebaseIdentityPlan> {
  const desiredUid = identity.firebaseUidHint ?? FALLBACK_FIREBASE_UID
  const [byUid, byEmail] = await Promise.all([
    optionalFirebaseUserByUid(auth, desiredUid),
    optionalFirebaseUserByEmail(auth, email),
  ])
  const record = identity.firebaseUidHint ? byUid : (byEmail ?? byUid)
  return {
    uid: record?.uid ?? desiredUid,
    exists: Boolean(record),
    currentEmail: record?.email ?? null,
    replacementUid: identity.firebaseUidHint && byEmail && byEmail.uid !== desiredUid ? byEmail.uid : null,
  }
}

async function restoreFirebaseIdentity(auth: Auth, plan: FirebaseIdentityPlan, credentials: TestCredentials) {
  if (plan.replacementUid) await auth.deleteUser(plan.replacementUid)
  const commonRequest = {
    email: credentials.email,
    password: credentials.password,
    displayName: 'Nómada',
    emailVerified: true,
    disabled: false,
  }
  const user = plan.exists
    ? await auth.updateUser(plan.uid, { ...commonRequest, photoURL: null })
    : await auth.createUser({ uid: plan.uid, ...commonRequest })
  if (user.uid !== plan.uid || user.email?.toLowerCase() !== credentials.email) {
    throw new Error('Firebase no devolvió la identidad demo esperada después de restaurarla.')
  }
  await auth.revokeRefreshTokens(user.uid)
  return user
}

async function readUserState(client: SqlClient, userId: string): Promise<UserState> {
  const result = await client.query<Record<keyof UserState, string>>(`
    SELECT
      (SELECT count(*)::text FROM categories WHERE user_id = $1) AS categories,
      (SELECT count(*)::text FROM financial_transactions WHERE user_id = $1) AS transactions,
      (SELECT count(*)::text FROM budgets WHERE user_id = $1) AS budgets,
      (SELECT count(*)::text FROM budget_periods WHERE user_id = $1) AS periods,
      (SELECT count(*)::text FROM user_module_instances WHERE user_id = $1) AS modules,
      (SELECT count(*)::text FROM store_rotations WHERE user_id = $1) AS rotations,
      (SELECT count(*)::text FROM store_offers o JOIN store_rotations r ON r.id = o.rotation_id WHERE r.user_id = $1) AS offers,
      (SELECT count(*)::text FROM store_offers o JOIN store_rotations r ON r.id = o.rotation_id
        WHERE r.user_id = $1 AND r.status = 'active' AND r.ends_at > now() AND o.purchased_at IS NULL AND o.expires_at > now()) AS "activeOffers",
      (SELECT count(*)::text FROM module_purchase_events WHERE user_id = $1) AS "purchaseEvents",
      (SELECT count(*)::text FROM module_repair_events WHERE user_id = $1) AS "repairEvents",
      (SELECT count(*)::text FROM damage_events WHERE user_id = $1) AS "damageEvents",
      (SELECT count(*)::text FROM level_history WHERE user_id = $1) AS "levelHistory",
      (SELECT count(*)::text FROM synthcoin_ledger WHERE user_id = $1) AS "coinLedger",
      (SELECT count(*)::text FROM flux_ledger WHERE user_id = $1) AS "fluxLedger",
      (SELECT count(*)::text FROM reward_allocations WHERE user_id = $1) AS "rewardAllocations"
  `, [userId])
  const row = result.rows[0]
  if (!row) throw new Error('Could not inspect the demo user.')
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) as unknown as UserState
}

async function loadProgressRules(client: SqlClient) {
  const thresholds = (await client.query<ThresholdRow>(`
    SELECT level, required_flux
      FROM level_thresholds
     WHERE level BETWEEN 22 AND 25
     ORDER BY level
  `)).rows
  for (const level of [22, 23, 24, 25]) {
    if (!thresholds.some((row) => row.level === level)) {
      throw new Error(`Falta level_thresholds.level=${level}. Ejecuta las migraciones y el seed global antes del reset.`)
    }
  }
  const familyRules = (await client.query<FamilyRuleRow>(`
    SELECT minimum_count, bonus_percent_bp
      FROM family_bonus_rules
     ORDER BY minimum_count DESC
  `)).rows
  if (!familyRules.length) throw new Error('Faltan las reglas globales de bonus de familia.')
  return { thresholds, familyRules }
}

async function upsertDefinitions(client: SqlClient, fixture: ProdDemoFixture) {
  const definitionIds = new Map<string, string>()
  for (const definition of fixture.definitions) {
    const result = await client.query<{ id: string }>(`
      INSERT INTO module_definitions
        (sku, name, slot, family, rarity, price_coins, power, shield, min_level, visual_key, description, active)
      VALUES ($1, $2, $3::module_slot, $4::module_family, $5::module_rarity, $6, $7, $8, $9, $10, $11, false)
      ON CONFLICT (sku) DO UPDATE SET
        name = excluded.name,
        slot = excluded.slot,
        family = excluded.family,
        rarity = excluded.rarity,
        price_coins = excluded.price_coins,
        power = excluded.power,
        shield = excluded.shield,
        min_level = excluded.min_level,
        visual_key = excluded.visual_key,
        description = excluded.description,
        active = false
      RETURNING id
    `, [
      definition.sku, definition.name, definition.slot, definition.family, definition.rarity,
      definition.priceCoins, definition.power, definition.shield, definition.minLevel,
      definition.sku, definition.description,
    ])
    const id = result.rows[0]?.id
    if (!id) throw new Error(`Could not upsert module definition ${definition.sku}.`)
    definitionIds.set(definition.sku, id)
  }
  return definitionIds
}

async function insertProfile(
  client: SqlClient,
  identity: { internalUserId: string; firebaseUid: string },
  credentials: TestCredentials,
  fixture: ProdDemoFixture,
) {
  await client.query(`
    INSERT INTO users
      (id, firebase_uid, email, password_hash, display_name, avatar_url, primary_currency, locale, timezone,
       week_starts_on, preferences, email_verified_at, guided_tour_completed_at, deleted_at)
    VALUES ($1, $2, $3, NULL, $4, NULL, $5, $6, $7, $8, $9::jsonb, now(), NULL, NULL)
  `, [
    identity.internalUserId, identity.firebaseUid, credentials.email, fixture.profile.displayName, fixture.profile.primaryCurrency,
    fixture.profile.locale, fixture.profile.timezone, fixture.profile.weekStartsOn, JSON.stringify(fixture.profile.preferences),
  ])
}

async function insertCategoriesAndTransactions(client: SqlClient, userId: string, fixture: ProdDemoFixture) {
  const categoryIds = new Map<string, string>()
  for (const category of fixture.categories) {
    await client.query(`
      INSERT INTO categories (id, user_id, name, icon_key, color_token, is_system_seed)
      VALUES ($1, $2, $3, $4, $5, true)
    `, [category.id, userId, category.name, category.icon, category.color])
    categoryIds.set(category.key, category.id)
  }
  for (const transaction of fixture.transactions) {
    const categoryId = categoryIds.get(transaction.categoryKey)
    if (!categoryId) throw new Error(`Unknown fixture category ${transaction.categoryKey}.`)
    await client.query(`
      INSERT INTO financial_transactions
        (id, user_id, category_id, type, status, concept, amount_minor, currency, occurred_at, locked_by_reward, created_at, updated_at)
      VALUES ($1, $2, $3, $4::transaction_type, $5::transaction_status, $6, $7, $8, $9, $10, $9, $9)
    `, [
      transaction.id, userId, categoryId, transaction.type, transaction.status, transaction.concept,
      transaction.amountMinor, transaction.currency, transaction.occurredAt, transaction.lockedByReward,
    ])
  }
  return categoryIds
}

async function insertBudgets(
  client: SqlClient,
  userId: string,
  fixture: ProdDemoFixture,
  categoryIds: Map<string, string>,
) {
  const transactions = new Map(fixture.transactions.map((transaction) => [transaction.id, transaction]))
  let rewardAllocationOrdinal = 0
  for (const budget of fixture.budgets) {
    const categoryId = budget.categoryKey ? categoryIds.get(budget.categoryKey) : null
    if (budget.categoryKey && !categoryId) throw new Error(`Unknown budget category ${budget.categoryKey}.`)
    await client.query(`
      INSERT INTO budgets
        (id, user_id, name, frequency, scope, category_id, limit_minor, currency, status, starts_on, timezone_snapshot)
      VALUES ($1, $2, $3, $4::budget_frequency, $5::budget_scope, $6, $7, $8, $9::budget_status, $10::date, $11)
    `, [
      budget.id, userId, budget.name, budget.frequency, budget.scope, categoryId, budget.limitMinor,
      budget.currency, budget.status, budget.startsAt.slice(0, 10), fixture.profile.timezone,
    ])
    const evaluatedAt = budget.periodStatus === 'open'
      ? null
      : new Date(Date.parse(budget.endsAt) + 5 * 60_000).toISOString()
    const idempotencyKey = budget.periodStatus === 'open'
      ? null
      : budget.periodId.replace(/^d310/, 'd311')
    await client.query(`
      INSERT INTO budget_periods
        (id, budget_id, user_id, starts_at, ends_at, timezone_snapshot, status, limit_minor_snapshot,
         currency_snapshot, spend_minor, surplus_minor, eligible_surplus_minor, excluded_reward_minor,
         synthcoins_awarded, flux_awarded, excess_percent_bp, base_damage, evaluated_at, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7::period_status, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      budget.periodId, budget.id, userId, budget.startsAt, budget.endsAt, fixture.profile.timezone,
      budget.periodStatus, budget.limitMinor, budget.currency, budget.spendMinor, budget.surplusMinor,
      budget.eligibleSurplusMinor, budget.excludedRewardMinor, budget.synthcoinsAwarded, budget.fluxAwarded,
      budget.excessPercentBp, budget.baseDamage, evaluatedAt, idempotencyKey,
    ])
    for (const transactionId of budget.transactionIds) {
      const transaction = transactions.get(transactionId)
      if (!transaction) throw new Error(`Unknown budget transaction ${transactionId}.`)
      await client.query(`
        INSERT INTO budget_period_transactions (period_id, transaction_id, counted_minor)
        VALUES ($1, $2, $3)
      `, [budget.periodId, transactionId, transaction.amountMinor])
    }
    if (budget.periodStatus === 'met' && budget.eligibleSurplusMinor > 0) {
      let remaining = budget.eligibleSurplusMinor
      let allocationOrder = 1
      for (const transactionId of budget.transactionIds) {
        if (remaining <= 0) break
        const transaction = transactions.get(transactionId)
        if (!transaction) throw new Error(`Unknown reward transaction ${transactionId}.`)
        const allocatedMinor = Math.min(remaining, transaction.amountMinor)
        rewardAllocationOrdinal += 1
        const allocationId = `d3200000-0000-4000-8000-${String(rewardAllocationOrdinal).padStart(12, '0')}`
        await client.query(`
          INSERT INTO reward_allocations
            (id, user_id, period_id, transaction_id, allocated_minor, allocation_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [allocationId, userId, budget.periodId, transactionId, allocatedMinor, allocationOrder])
        await client.query('UPDATE financial_transactions SET locked_by_reward = true WHERE id = $1', [transactionId])
        remaining -= allocatedMinor
        allocationOrder += 1
      }
      if (remaining !== 0) throw new Error(`Reward allocations do not cover ${budget.name}.`)
    }
  }
}

async function insertModules(
  client: SqlClient,
  userId: string,
  fixture: ProdDemoFixture,
  definitionIds: Map<string, string>,
) {
  const definitions = new Map(fixture.definitions.map((definition) => [definition.sku, definition]))
  for (const module of fixture.modules) {
    const definition = definitions.get(module.sku)
    const definitionId = definitionIds.get(module.sku)
    if (!definition || !definitionId) throw new Error(`Unknown equipped module ${module.sku}.`)
    await client.query(`
      INSERT INTO user_module_instances
        (id, user_id, definition_id, slot, original_price_coins, power_snapshot, shield_snapshot,
         energy, state, equipped_at, destroyed_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4::module_slot, $5, $6, $7, $8, $9::module_state, $10, $11, $10, $10)
    `, [
      module.id, userId, definitionId, definition.slot, definition.priceCoins, definition.power,
      definition.shield, module.energy, module.state, module.equippedAt, module.destroyedAt,
    ])
  }
}

async function calculateNormalizedProgress(
  client: SqlClient,
  userId: string,
  fixture: ProdDemoFixture,
  thresholds: ThresholdRow[],
  familyRules: FamilyRuleRow[],
): Promise<NormalizedProgress> {
  const familyRows = (await client.query<{ family: string; count: string; power: string }>(`
    SELECT d.family::text AS family, count(*)::text AS count, sum(i.power_snapshot)::text AS power
      FROM user_module_instances i
      JOIN module_definitions d ON d.id = i.definition_id
     WHERE i.user_id = $1 AND i.state = 'equipped' AND i.energy > 0
     GROUP BY d.family
  `, [userId])).rows
  const activePower = familyRows.reduce((sum, row) => sum + Number(row.power), 0)
  const familyBonusPower = familyRows.reduce((sum, row) => {
    const rule = familyRules.find((candidate) => Number(row.count) >= candidate.minimum_count)
    return sum + Math.trunc(Number(row.power) * (rule?.bonus_percent_bp ?? 0) / 10_000)
  }, 0)
  const currentLevelFlux = thresholds.find((row) => row.level === fixture.targetProgress.level)?.required_flux
  const nextLevelFlux = thresholds.find((row) => row.level === fixture.targetProgress.level + 1)?.required_flux
  if (currentLevelFlux === undefined || nextLevelFlux === undefined) throw new Error('Target level thresholds are incomplete.')
  const totalFlux = currentLevelFlux + Math.round((nextLevelFlux - currentLevelFlux) * fixture.targetProgress.levelProgressRatio)
  const baseFlux = totalFlux - activePower - familyBonusPower
  if (baseFlux < 0) throw new Error('The live progression rules cannot represent the demo fixture at level 24.')
  return {
    level: fixture.targetProgress.level,
    baseFlux,
    activePower,
    familyBonusPower,
    totalFlux,
    currentLevelFlux,
    nextLevelFlux,
  }
}

async function insertProgressAndLevelHistory(
  client: SqlClient,
  userId: string,
  fixture: ProdDemoFixture,
  progress: NormalizedProgress,
  thresholds: ThresholdRow[],
) {
  await client.query(`
    INSERT INTO user_progress
      (user_id, base_flux, active_power, family_bonus_power, total_flux, level, synthcoin_balance,
       weekly_streak, monthly_streak)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    userId, progress.baseFlux, progress.activePower, progress.familyBonusPower, progress.totalFlux,
    progress.level, fixture.targetProgress.synthcoins, fixture.targetProgress.weeklyStreak,
    fixture.targetProgress.monthlyStreak,
  ])
  const history = [
    { id: 'd7400000-0000-4000-8000-000000000001', oldLevel: 23, newLevel: 24, at: fixture.history.level24At, reason: 'moduleEquipped' },
    { id: 'd7400000-0000-4000-8000-000000000002', oldLevel: 22, newLevel: 23, at: fixture.history.level23At, reason: 'monthlyCycle' },
    { id: 'd7400000-0000-4000-8000-000000000003', oldLevel: 21, newLevel: 22, at: fixture.history.level22At, reason: 'familyBonus' },
  ]
  for (const item of history) {
    const totalFlux = thresholds.find((threshold) => threshold.level === item.newLevel)?.required_flux
    if (totalFlux === undefined) throw new Error(`Missing threshold for level ${item.newLevel}.`)
    await client.query(`
      INSERT INTO level_history (id, user_id, old_level, new_level, total_flux, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [item.id, userId, item.oldLevel, item.newLevel, totalFlux, item.reason, item.at])
  }
}

async function insertStoreAndHistory(
  client: SqlClient,
  userId: string,
  fixture: ProdDemoFixture,
  definitionIds: Map<string, string>,
  progress: NormalizedProgress,
) {
  await client.query(`
    INSERT INTO store_rotations (id, user_id, starts_at, ends_at, seed, user_level_snapshot, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'active')
  `, [
    fixture.rotation.id, userId, fixture.rotation.startsAt, fixture.rotation.endsAt,
    fixture.rotation.seed, progress.level,
  ])
  for (const offer of fixture.offers) {
    const definitionId = definitionIds.get(offer.sku)
    if (!definitionId) throw new Error(`Unknown offer definition ${offer.sku}.`)
    await client.query(`
      INSERT INTO store_offers
        (id, rotation_id, module_definition_id, price_snapshot, min_level_snapshot, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [offer.id, fixture.rotation.id, definitionId, offer.priceCoins, offer.minLevel, offer.expiresAt])
  }

  const historicRotationId = 'd5000000-0000-4000-8000-000000000002'
  const historicOfferId = 'd5100000-0000-4000-8000-000000000007'
  const historicEndsAt = new Date(Date.parse(fixture.history.purchaseAt) + 86_400_000).toISOString()
  const historicStartsAt = new Date(Date.parse(fixture.history.purchaseAt) - 7 * 86_400_000).toISOString()
  const expansionDefinitionId = definitionIds.get('mock.mod-expansion')
  if (!expansionDefinitionId) throw new Error('Missing historic purchase definition.')
  await client.query(`
    INSERT INTO store_rotations (id, user_id, starts_at, ends_at, seed, user_level_snapshot, status)
    VALUES ($1, $2, $3, $4, $5, 23, 'expired')
  `, [historicRotationId, userId, historicStartsAt, historicEndsAt, 'prod-demo:historic-purchase'])
  await client.query(`
    INSERT INTO store_offers
      (id, rotation_id, module_definition_id, price_snapshot, min_level_snapshot, expires_at, purchased_at)
    VALUES ($1, $2, $3, 1260, 20, $4, $5)
  `, [historicOfferId, historicRotationId, expansionDefinitionId, historicEndsAt, fixture.history.purchaseAt])

  const expansionInstanceId = fixture.modules.find((module) => module.sku === 'mock.mod-expansion')?.id
  const networkInstanceId = fixture.modules.find((module) => module.sku === 'mock.mod-network')?.id
  const powerInstanceId = fixture.modules.find((module) => module.sku === 'mock.mod-power')?.id
  const metPeriodId = fixture.budgets.find((budget) => budget.periodStatus === 'met')?.periodId
  const exceededPeriodId = fixture.budgets.find((budget) => budget.periodStatus === 'exceeded')?.periodId
  if (!expansionInstanceId || !networkInstanceId || !powerInstanceId || !metPeriodId || !exceededPeriodId) {
    throw new Error('The demo history references an incomplete fixture.')
  }

  await client.query(`
    INSERT INTO module_purchase_events
      (id, user_id, offer_id, new_instance_id, replaced_instance_id, new_price, trade_in_value,
       net_cost, balance_before, balance_after, idempotency_key, created_at)
    VALUES ('d7000000-0000-4000-8000-000000000001', $1, $2, $3, NULL, 1260, 200, 1060, 3394, 2334,
            'd7100000-0000-4000-8000-000000000001', $4)
  `, [userId, historicOfferId, expansionInstanceId, fixture.history.purchaseAt])
  await client.query(`
    INSERT INTO module_repair_events
      (id, user_id, module_instance_id, energy_before, energy_after, damage_percent_bp, original_price,
       repair_cost, balance_before, balance_after, idempotency_key, created_at)
    VALUES ('d7000000-0000-4000-8000-000000000002', $1, $2, 90, 100, 1000, 840, 84, 3478, 3394,
            'd7100000-0000-4000-8000-000000000002', $3)
  `, [userId, powerInstanceId, fixture.history.repairAt])
  await client.query(`
    INSERT INTO damage_events (id, user_id, period_id, base_damage, idempotency_key, created_at)
    VALUES ('d7000000-0000-4000-8000-000000000003', $1, $2, 62,
            'd7100000-0000-4000-8000-000000000003', $3)
  `, [userId, exceededPeriodId, fixture.history.damageAt])
  await client.query(`
    INSERT INTO module_damage_events
      (id, damage_event_id, module_instance_id, shield_snapshot, energy_before, damage_applied,
       energy_after, destroyed, created_at)
    VALUES ('d7000000-0000-4000-8000-000000000004',
            'd7000000-0000-4000-8000-000000000003', $1, 4, 80, 62, 18, false, $2)
  `, [networkInstanceId, fixture.history.damageAt])

  await client.query(`
    INSERT INTO synthcoin_ledger
      (id, user_id, type, amount, balance_after, period_id, idempotency_key, metadata, created_at)
    VALUES ('d6000000-0000-4000-8000-000000000001', $1, 'budget_reward', 46, 2380, $2,
            'd7100000-0000-4000-8000-000000000004', '{"source":"prod-demo-reset"}'::jsonb, $3)
  `, [userId, metPeriodId, fixture.history.rewardAt])
  await client.query(`
    INSERT INTO synthcoin_ledger
      (id, user_id, type, amount, balance_after, module_instance_id, reference_id,
       idempotency_key, metadata, created_at)
    VALUES ('d6000000-0000-4000-8000-000000000002', $1, 'purchase', -1060, 2334, $2,
            'd7000000-0000-4000-8000-000000000001', 'd7100000-0000-4000-8000-000000000001',
            '{"source":"prod-demo-reset"}'::jsonb, $3)
  `, [userId, expansionInstanceId, fixture.history.purchaseAt])
  await client.query(`
    INSERT INTO synthcoin_ledger
      (id, user_id, type, amount, balance_after, module_instance_id, reference_id,
       idempotency_key, metadata, created_at)
    VALUES ('d6000000-0000-4000-8000-000000000003', $1, 'repair', -84, 3394, $2,
            'd7000000-0000-4000-8000-000000000002', 'd7100000-0000-4000-8000-000000000002',
            '{"source":"prod-demo-reset"}'::jsonb, $3)
  `, [userId, powerInstanceId, fixture.history.repairAt])
  await client.query(`
    INSERT INTO flux_ledger
      (id, user_id, type, amount, base_flux_after, period_id, idempotency_key, metadata, created_at)
    VALUES ('d6200000-0000-4000-8000-000000000001', $1, 'budget_completion', 25, $2, $3,
            'd7100000-0000-4000-8000-000000000005', '{"source":"prod-demo-reset"}'::jsonb, $4)
  `, [userId, progress.baseFlux, metPeriodId, fixture.history.rewardAt])
}

function assertExpectedState(state: UserState) {
  const expected: Partial<UserState> = {
    categories: 8,
    transactions: 12,
    budgets: 5,
    periods: 5,
    modules: 9,
    rotations: 2,
    offers: 7,
    activeOffers: 6,
    purchaseEvents: 1,
    repairEvents: 1,
    damageEvents: 1,
    levelHistory: 3,
    coinLedger: 3,
    fluxLedger: 1,
    rewardAllocations: 2,
  }
  for (const [key, value] of Object.entries(expected) as Array<[keyof UserState, number]>) {
    if (state[key] !== value) throw new Error(`Post-reset verification failed: ${key}=${state[key]}, expected ${value}.`)
  }
}

export async function resetProdDemoUser(
  client: SqlClient,
  canonical: CanonicalIdentity,
  firebaseUid: string,
  credentials: TestCredentials,
  now = new Date(),
) {
  const fixture = buildProdDemoFixture(now)
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`prod-demo-reset:${credentials.email}`])
    const candidates = (await client.query<DatabaseUser>(`
      SELECT id, email::text, firebase_uid, deleted_at
        FROM users
       WHERE id = $1
          OR email = $2
          OR firebase_uid = $3
       FOR UPDATE
    `, [canonical.internalUserId, credentials.email, firebaseUid])).rows
    const canonicalRow = candidates.find((candidate) => candidate.id === canonical.internalUserId)
    if (canonicalRow?.firebase_uid && canonicalRow.firebase_uid !== firebaseUid) {
      throw new Error('El UUID interno canónico está asociado a un UID Firebase diferente.')
    }
    const previousUser = canonicalRow
      ?? candidates.find((candidate) => candidate.firebase_uid === firebaseUid)
      ?? candidates.find((candidate) => candidate.email.toLowerCase() === credentials.email)
      ?? null
    const before = await readUserState(client, previousUser?.id ?? canonical.internalUserId)
    const { thresholds, familyRules } = await loadProgressRules(client)

    const checkpointRequestId = randomUUID()
    await client.query(`
      DELETE FROM audit_events
       WHERE action = $1
         AND entity_type = 'user'
         AND (entity_id = $2 OR metadata->>'credentialEmail' = $3)
    `, [CHECKPOINT_ACTION, canonical.internalUserId, credentials.email])
    await client.query(`
      INSERT INTO audit_events
        (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'maintenance', $2, 'user', $3, $4,
              jsonb_build_object(
                'firebaseUid', $5::text,
                'credentialEmail', $6::text,
                'fixtureVersion', $7::text
              ))
    `, [
      previousUser?.id ?? null,
      CHECKPOINT_ACTION,
      canonical.internalUserId,
      checkpointRequestId,
      firebaseUid,
      credentials.email,
      PROD_DEMO_FIXTURE_VERSION,
    ])

    const candidateIds = candidates.map((candidate) => candidate.id)
    await client.query(`
      DELETE FROM job_runs
       WHERE scope_id IN (SELECT id FROM budget_periods WHERE user_id = ANY($1::uuid[]))
    `, [candidateIds])
    await client.query(`
      DELETE FROM audit_events
       WHERE user_id = ANY($1::uuid[])
         AND request_id <> $2
    `, [candidateIds, checkpointRequestId])
    await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [candidateIds])

    const user = {
      id: canonical.internalUserId,
      firebase_uid: firebaseUid,
      email: credentials.email,
    }
    await insertProfile(client, {
      internalUserId: user.id,
      firebaseUid: user.firebase_uid,
    }, credentials, fixture)
    const definitionIds = await upsertDefinitions(client, fixture)
    const categoryIds = await insertCategoriesAndTransactions(client, user.id, fixture)
    await insertBudgets(client, user.id, fixture, categoryIds)
    await insertModules(client, user.id, fixture, definitionIds)
    const progress = await calculateNormalizedProgress(client, user.id, fixture, thresholds, familyRules)
    await insertProgressAndLevelHistory(client, user.id, fixture, progress, thresholds)
    await insertStoreAndHistory(client, user.id, fixture, definitionIds, progress)

    await client.query(`
      UPDATE audit_events
         SET user_id = $1
       WHERE request_id = $2
         AND action = $3
    `, [user.id, checkpointRequestId, CHECKPOINT_ACTION])
    await client.query(`
      INSERT INTO audit_events
        (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
      VALUES ($1, 'maintenance', 'prod_demo.reset', 'user', $1, $2,
              jsonb_build_object(
                'fixtureVersion', $3::text,
                'generatedAt', $4::text,
                'credentialEmail', $5::text,
                'firebaseUid', $6::text
              ))
    `, [
      user.id,
      randomUUID(),
      PROD_DEMO_FIXTURE_VERSION,
      fixture.generatedAt,
      credentials.email,
      firebaseUid,
    ])

    const after = await readUserState(client, user.id)
    assertExpectedState(after)
    const identity = (await client.query<DatabaseUser>(`
      SELECT id, email::text, firebase_uid, deleted_at
        FROM users
       WHERE id = $1
         AND deleted_at IS NULL
    `, [user.id])).rows[0]
    if (
      !identity
      || identity.firebase_uid !== user.firebase_uid
      || identity.email.toLowerCase() !== credentials.email
    ) {
      throw new Error('Post-reset verification failed: la identidad canónica no se ha restaurado.')
    }
    await client.query('COMMIT')
    return { user, before, after, progress, generatedAt: fixture.generatedAt }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

function printState(label: string, state: UserState) {
  console.log(label)
  console.table(state)
}

async function main() {
  let credentials: TestCredentials
  try {
    credentials = await readTestCredentials()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }

  let options: ResetOptions
  try {
    options = parseResetArgs(process.argv.slice(2), credentials.email)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }
  if (options.mode === 'help') {
    console.log(usage(credentials.email))
    return
  }

  const connectionString = process.env[DATABASE_URL_ENV]?.trim()
  if (!connectionString) {
    console.error(`Falta ${DATABASE_URL_ENV}.\n\n${usage(credentials.email)}`)
    process.exitCode = 1
    return
  }

  let target
  try {
    target = safeDatabaseLabel(connectionString)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
    return
  }
  console.log(`Destino: ${target.label}`)
  if (target.pooled) console.warn('Aviso: se recomienda la URL direct de Neon para esta operación de mantenimiento.')

  const client = new Client({
    connectionString,
    application_name: 'budget-runner-prod-demo-reset',
    connectionTimeoutMillis: 10_000,
  })
  let firebaseApp: App | null = null
  let firebaseRestoreAttempted = false
  try {
    await client.connect()
    await client.query("SET lock_timeout = '10s'")
    await client.query("SET statement_timeout = '60s'")
    await client.query("SET idle_in_transaction_session_timeout = '60s'")
    const firebase = await initializeFirebaseAdmin()
    firebaseApp = firebase.app
    const canonical = await resolveCanonicalIdentity(client, credentials.email)
    const firebasePlan = await inspectFirebaseIdentity(firebase.auth, canonical, credentials.email)

    if (options.mode === 'dry-run') {
      const state = await readUserState(
        client,
        canonical.existingDatabaseUser?.id ?? canonical.internalUserId,
      )
      await loadProgressRules(client)
      console.log(`Email canónico: ${credentials.email}`)
      console.log(`Proyecto Firebase: ${firebase.projectId}`)
      console.log(`UUID interno canónico: ${canonical.internalUserId} (origen: ${canonical.source})`)
      console.log(`Fila PostgreSQL actual: ${canonical.existingDatabaseUser?.id ?? 'ausente; se recreará'}`)
      console.log(`Firebase UID canónico: ${firebasePlan.uid}`)
      console.log(`Cuenta Firebase: ${firebasePlan.exists ? `presente (${firebasePlan.currentEmail ?? 'sin email'})` : 'ausente; se recreará'}`)
      if (firebasePlan.replacementUid) {
        console.log(`Identidad Firebase de reemplazo: ${firebasePlan.replacementUid} (se retirará)`)
      }
      printState('Estado actual (solo lectura):', state)
      console.log('El reset restauraría email, contraseña, nombre visible y estado de la cuenta desde testuser.nfo.')
      console.log('También regeneraría 8 categorías, 12 transacciones, 5 presupuestos, 9 módulos y 6 ofertas activas.')
      console.log('No se ha modificado ningún dato.')
      return
    }

    console.warn(`Se restaurarán la identidad, las credenciales y los datos de ${credentials.email}.`)
    firebaseRestoreAttempted = true
    const firebaseUser = await restoreFirebaseIdentity(firebase.auth, firebasePlan, credentials)
    const result = await resetProdDemoUser(client, canonical, firebaseUser.uid, credentials)
    printState('Estado anterior:', result.before)
    printState('Estado regenerado:', result.after)
    console.log(`Progreso normalizado: nivel ${result.progress.level}, Flux ${result.progress.totalFlux}, SynthCoins 2380.`)
    console.log(`Reset completado (${result.generatedAt}). UUID interno ${result.user.id}; Firebase UID ${result.user.firebase_uid}.`)
  } catch (error) {
    if (firebaseRestoreAttempted) {
      console.error('Firebase pudo modificarse antes del fallo; PostgreSQL se ha revertido. Es seguro volver a ejecutar el reset.')
    } else {
      console.error('El reset no se ha completado.')
    }
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await client.end().catch(() => undefined)
    if (firebaseApp) await deleteApp(firebaseApp).catch(() => undefined)
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  void main()
}
