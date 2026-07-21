import { randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import {
  type AppRequest,
  googleOAuthCookieClearOptions,
  googleOAuthCookieName,
  googleOAuthCookieOptions,
  hashIp,
  hashToken,
  refreshCookieName,
  refreshCookieOptions,
  requireAuth,
  signGoogleOAuthState,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  verifyGoogleOAuthState,
} from '../auth.js'
import { config } from '../config.js'
import { type DbClient, pool, withTransaction } from '../db.js'
import { ApiError, asyncHandler } from '../errors.js'
import { getProgressSummary } from '../progress.js'
import { createGoogleAuthorizationRequest, exchangeGoogleCode, findOrCreateGoogleUser } from '../googleOAuth.js'
import { provisionNewUser } from '../userProvisioning.js'

const registerSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(10).max(128),
  displayName: z.string().trim().min(2).max(80),
  currency: z.string().regex(/^[A-Z]{3}$/).default('EUR'),
  timezone: z.string().min(3).max(64).default('Europe/Madrid'),
  locale: z.enum(['es-ES', 'en-US', 'fr-FR', 'de-DE', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR']).default('en-US'),
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
    helpHints: z.boolean(),
  }).optional(),
  locale: z.enum(['es-ES', 'en-US', 'fr-FR', 'de-DE', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR']).optional(),
}).refine((input) => input.preferences !== undefined || input.locale !== undefined, { message: 'At least one profile field is required.' })

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
    guided_tour_completed_at: Date | null; google_connected: boolean;
  }>(`SELECT u.id, u.email, u.display_name, u.avatar_url, u.primary_currency, u.locale, u.timezone,
      u.week_starts_on, u.preferences, u.guided_tour_completed_at,
      EXISTS (SELECT 1 FROM oauth_accounts oa WHERE oa.user_id = u.id AND oa.provider = 'google') AS google_connected
    FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL`, [userId])
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
    googleConnected: user.google_connected,
    guidedTourCompleted: user.guided_tour_completed_at !== null,
    preferences: user.preferences,
  }
}

export const authRouter = Router()

authRouter.post('/register', asyncHandler(async (request, response) => {
  const input = registerSchema.parse(request.body)
  const result = await withTransaction(async (client) => {
    const passwordHash = await bcrypt.hash(input.password, 12)
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO users (email, password_hash, display_name, primary_currency, timezone, locale)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [input.email, passwordHash, input.displayName, input.currency, input.timezone, input.locale])
    const userId = inserted.rows[0]?.id
    if (!userId) throw new Error('User insert failed')
    await provisionNewUser(client, userId)
    const session = await createSession(client, userId, request)
    return { session, user: await userDto(client, userId) }
  })
  response.cookie(refreshCookieName, result.session.refreshToken, refreshCookieOptions)
  response.status(201).json({ data: { accessToken: result.session.accessToken, user: result.user }, meta: {} })
}))

function oauthResultUrl(error?: string) {
  const url = new URL('/oauth/callback', config.frontendUrl)
  if (error) url.searchParams.set('error', error)
  return url.toString()
}

authRouter.get('/google', asyncHandler(async (request, response) => {
  if (!config.googleOAuthEnabled) {
    response.redirect(oauthResultUrl('google_not_configured'))
    return
  }
  const authorization = createGoogleAuthorizationRequest()
  const locale = z.enum(['es-ES', 'en-US', 'fr-FR', 'de-DE', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR']).catch('en-US').parse(request.query.locale)
  response.cookie(googleOAuthCookieName, signGoogleOAuthState({ ...authorization, locale }), googleOAuthCookieOptions)
  response.redirect(authorization.url)
}))

authRouter.get('/google/callback', asyncHandler(async (request, response) => {
  response.clearCookie(googleOAuthCookieName, googleOAuthCookieClearOptions)
  const providerError = typeof request.query.error === 'string' ? request.query.error : undefined
  if (providerError) {
    response.redirect(oauthResultUrl(providerError === 'access_denied' ? 'access_denied' : 'google_rejected'))
    return
  }
  const code = typeof request.query.code === 'string' ? request.query.code : undefined
  const returnedState = typeof request.query.state === 'string' ? request.query.state : undefined
  const stateCookie = request.cookies?.[googleOAuthCookieName] as string | undefined
  if (!code || !returnedState || !stateCookie) {
    response.redirect(oauthResultUrl('invalid_oauth_callback'))
    return
  }

  let oauthState
  try { oauthState = verifyGoogleOAuthState(stateCookie) } catch {
    response.redirect(oauthResultUrl('invalid_oauth_state'))
    return
  }
  if (oauthState.state !== returnedState) {
    response.redirect(oauthResultUrl('invalid_oauth_state'))
    return
  }

  try {
    const identity = await exchangeGoogleCode(code, oauthState.codeVerifier, oauthState.nonce)
    const session = await withTransaction(async (client) => {
      const userId = await findOrCreateGoogleUser(client, identity, oauthState.locale)
      await client.query(`
        INSERT INTO audit_events (user_id, actor_type, action, entity_type, entity_id, request_id, metadata)
        VALUES ($1, 'user', 'auth.google_login', 'user', $1, $2, jsonb_build_object('provider', 'google'))
      `, [userId, (request as AppRequest).requestId])
      return createSession(client, userId, request)
    })
    response.cookie(refreshCookieName, session.refreshToken, refreshCookieOptions)
    response.redirect(oauthResultUrl())
  } catch (error) {
    console.error(`[${(request as AppRequest).requestId}] Google OAuth callback failed`, error)
    response.redirect(oauthResultUrl('google_exchange_failed'))
  }
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
  response.json({ data: { ...user, progress, levelHistory: history.rows.map((item) => ({ level: item.new_level, flux: item.total_flux, reachedAt: item.created_at.toISOString(), reason: { key: `levelReason.${item.reason}` } })) }, meta: {} })
}))

meRouter.patch('/', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const input = preferencesSchema.parse(request.body)
  await pool.query(`UPDATE users
    SET preferences = coalesce($2::jsonb, preferences), locale = coalesce($3, locale)
    WHERE id = $1 AND deleted_at IS NULL`, [userId, input.preferences ? JSON.stringify(input.preferences) : null, input.locale ?? null])
  const [user, progress, history] = await Promise.all([
    userDto(pool, userId),
    getProgressSummary(pool, userId),
    pool.query<{ new_level: number; total_flux: number; created_at: Date; reason: string }>(
      'SELECT new_level, total_flux, created_at, reason FROM level_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId],
    ),
  ])
  response.json({ data: { ...user, progress, levelHistory: history.rows.map((item) => ({ level: item.new_level, flux: item.total_flux, reachedAt: item.created_at.toISOString(), reason: { key: `levelReason.${item.reason}` } })) }, meta: {} })
}))

meRouter.post('/guided-tour/complete', asyncHandler(async (request, response) => {
  const userId = (request as AppRequest).userId
  const updated = await pool.query<{ guided_tour_completed_at: Date }>(`
    UPDATE users
       SET guided_tour_completed_at = coalesce(guided_tour_completed_at, now())
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING guided_tour_completed_at
  `, [userId])
  if (!updated.rows[0]) throw new ApiError(404, 'USER_NOT_FOUND', 'No se ha encontrado el usuario.')
  response.json({ data: { guidedTourCompleted: true }, meta: {} })
}))
