import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import {
  type AppRequest,
  hashIp,
  hashToken,
  refreshCookieName,
  refreshCookieOptions,
  requireAuth,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../auth.js'
import { config } from '../config.js'
import { type DbClient, pool, withTransaction } from '../db.js'
import { ApiError, asyncHandler } from '../errors.js'
import { getProgressSummary } from '../progress.js'

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(2).max(80),
  currency: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  timezone: z.string().min(3).max(64).default('Europe/Madrid'),
})

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
})

const preferencesSchema = z.object({
  preferences: z.object({
    reducedMotion: z.boolean(),
    ambientEffects: z.boolean(),
    audioReactive: z.boolean(),
    scanlines: z.boolean(),
    compactMode: z.boolean(),
  }),
})

const defaultCategories = [
  ['Combustible de Neón', 'fuel', '#FF007F'],
  ['Raciones Orbitales', 'utensils', '#00FFFF'],
  ['Mantenimiento del Hovercar', 'wrench', '#8B00FF'],
  ['Suscripciones de la Red', 'radio', '#A69DFF'],
  ['Ocio Holográfico', 'gamepad', '#F785C6'],
  ['Salud Biónica', 'heart-pulse', '#FF6E84'],
  ['Vivienda en la Megaciudad', 'building', '#FFD43F'],
  ['Tecnología del Cyberdeck', 'cpu', '#7DD3FC'],
  ['Otros', 'shapes', '#986780'],
] as const

async function createSession(client: DbClient, userId: string, request: Request, rotatedFromId?: string) {
  const sessionId = randomUUID()
  const refreshToken = signRefreshToken(userId, sessionId)
  const expiresAt = new Date(Date.now() + config.refreshTokenDays * 86_400_000)
  await client.query(`
    INSERT INTO refresh_sessions (id, user_id, token_hash, user_agent, ip_hash, expires_at, rotated_from_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [sessionId, userId, hashToken(refreshToken), request.header('user-agent') ?? null, hashIp(request.ip), expiresAt, rotatedFromId ?? null])
  return { accessToken: signAccessToken(userId), refreshToken }
}

async function userDto(client: DbClient, userId: string) {
  const result = await client.query<{
    id: string; email: string; display_name: string; avatar_url: string | null; primary_currency: string;
    locale: string; timezone: string; week_starts_on: number; preferences: Record<string, boolean>;
  }>('SELECT id, email, display_name, avatar_url, primary_currency, locale, timezone, week_starts_on, preferences FROM users WHERE id = $1 AND deleted_at IS NULL', [userId])
  const user = result.rows[0]
  if (!user) throw new ApiError(404, 'USER_NOT_FOUND', 'No se ha encontrado el usuario.')
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    ...(user.avatar_url ? { avatarUrl: user.avatar_url } : {}),
    primaryCurrency: user.primary_currency,
    locale: user.locale,
    timezone: user.timezone,
    weekStartsOn: user.week_starts_on,
    googleConnected: false,
    preferences: user.preferences,
  }
}

export const authRouter = Router()

authRouter.post('/register', asyncHandler(async (request, response) => {
  const input = registerSchema.parse(request.body)
  const result = await withTransaction(async (client) => {
    const passwordHash = await bcrypt.hash(input.password, 12)
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO users (email, password_hash, display_name, primary_currency, timezone)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [input.email, passwordHash, input.displayName, input.currency, input.timezone])
    const userId = inserted.rows[0]?.id
    if (!userId) throw new Error('User insert failed')
    await client.query('INSERT INTO user_progress (user_id) VALUES ($1)', [userId])
    for (const [name, icon, color] of defaultCategories) {
      await client.query(`
        INSERT INTO categories (user_id, name, icon_key, color_token, is_system_seed)
        VALUES ($1, $2, $3, $4, true)
      `, [userId, name, icon, color])
    }
    const session = await createSession(client, userId, request)
    return { session, user: await userDto(client, userId) }
  })
  response.cookie(refreshCookieName, result.session.refreshToken, refreshCookieOptions)
  response.status(201).json({ data: { accessToken: result.session.accessToken, user: result.user }, meta: {} })
}))

authRouter.post('/login', asyncHandler(async (request, response) => {
  const input = loginSchema.parse(request.body)
  const found = await pool.query<{ id: string; password_hash: string | null }>(
    'SELECT id, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL', [input.email],
  )
  const user = found.rows[0]
  if (!user?.password_hash || !await bcrypt.compare(input.password, user.password_hash)) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos.')
  }
  const session = await createSession(pool, user.id, request)
  response.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions)
  response.json({ data: { accessToken: session.accessToken, user: await userDto(pool, user.id) }, meta: {} })
}))

authRouter.post('/refresh', asyncHandler(async (request, response) => {
  const token = request.cookies?.[refreshCookieName] as string | undefined
  if (!token) throw new ApiError(401, 'REFRESH_TOKEN_REQUIRED', 'La sesión no se puede renovar.')
  let payload
  try { payload = verifyRefreshToken(token) } catch { throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'La sesión no se puede renovar.') }
  const result = await withTransaction(async (client) => {
    const session = await client.query<{ id: string }>(`
      SELECT id FROM refresh_sessions
       WHERE id = $1 AND user_id = $2 AND token_hash = $3 AND revoked_at IS NULL AND expires_at > now()
       FOR UPDATE
    `, [payload.sid, payload.sub, hashToken(token)])
    if (!session.rows[0]) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'La sesión no se puede renovar.')
    await client.query('UPDATE refresh_sessions SET revoked_at = now() WHERE id = $1', [payload.sid])
    return createSession(client, payload.sub, request, payload.sid)
  })
  response.cookie(refreshCookieName, result.refreshToken, refreshCookieOptions)
  response.json({ data: { accessToken: result.accessToken }, meta: {} })
}))

authRouter.post('/logout', asyncHandler(async (request, response) => {
  const token = request.cookies?.[refreshCookieName] as string | undefined
  if (token) await pool.query('UPDATE refresh_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [hashToken(token)])
  response.clearCookie(refreshCookieName, refreshCookieOptions)
  response.status(204).send()
}))

export const meRouter = Router()
meRouter.use(requireAuth)
meRouter.get('/', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const [user, progress, history] = await Promise.all([
    userDto(pool, userId),
    getProgressSummary(pool, userId),
    pool.query<{ new_level: number; total_flux: number; created_at: Date; reason: string }>(
      'SELECT new_level, total_flux, created_at, reason FROM level_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId],
    ),
  ])
  response.json({ data: { ...user, progress, levelHistory: history.rows.map((item) => ({ level: item.new_level, flux: item.total_flux, reachedAt: item.created_at.toISOString(), reason: item.reason })) }, meta: {} })
}))

meRouter.patch('/', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const input = preferencesSchema.parse(request.body)
  await pool.query('UPDATE users SET preferences = $2 WHERE id = $1 AND deleted_at IS NULL', [userId, input.preferences])
  const [user, progress, history] = await Promise.all([
    userDto(pool, userId),
    getProgressSummary(pool, userId),
    pool.query<{ new_level: number; total_flux: number; created_at: Date; reason: string }>(
      'SELECT new_level, total_flux, created_at, reason FROM level_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId],
    ),
  ])
  response.json({ data: { ...user, progress, levelHistory: history.rows.map((item) => ({ level: item.new_level, flux: item.total_flux, reachedAt: item.created_at.toISOString(), reason: item.reason })) }, meta: {} })
}))
