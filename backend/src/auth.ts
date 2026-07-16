import { createHash, randomUUID } from 'node:crypto'
import type { CookieOptions, NextFunction, Request, Response } from 'express'
import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken'
import { config } from './config.js'
import { ApiError } from './errors.js'

interface BudgetRunnerToken extends JwtPayload {
  sub: string
  type: 'access' | 'refresh'
  sid?: string
}

export interface AppRequest extends Request {
  requestId: string
  userId: string
}

export const refreshCookieName = 'budget_runner_refresh'

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: config.cookieSecure,
  path: '/api/v1/auth',
  maxAge: config.refreshTokenDays * 24 * 60 * 60 * 1000,
}

export function signAccessToken(userId: string) {
  const options: SignOptions = { expiresIn: config.accessTokenTtl as NonNullable<SignOptions['expiresIn']> }
  return jwt.sign(
    { sub: userId, type: 'access' },
    config.accessTokenSecret as Secret,
    options,
  )
}

export function signRefreshToken(userId: string, sessionId: string) {
  const options: SignOptions = { expiresIn: `${config.refreshTokenDays}d` as NonNullable<SignOptions['expiresIn']> }
  return jwt.sign(
    { sub: userId, sid: sessionId, type: 'refresh' },
    config.refreshTokenSecret as Secret,
    options,
  )
}

export function verifyRefreshToken(token: string): BudgetRunnerToken {
  const payload = jwt.verify(token, config.refreshTokenSecret) as BudgetRunnerToken
  if (payload.type !== 'refresh' || !payload.sub || !payload.sid) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'La sesión no es válida.')
  return payload
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function hashIp(value: string | undefined) {
  return value ? createHash('sha256').update(value).digest('hex') : null
}

export function requireAuth(request: Request, _response: Response, next: NextFunction) {
  const authorization = request.header('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    next(new ApiError(401, 'AUTHENTICATION_REQUIRED', 'Debes iniciar sesión.'))
    return
  }

  try {
    const payload = jwt.verify(authorization.slice(7), config.accessTokenSecret) as BudgetRunnerToken
    if (payload.type !== 'access' || !payload.sub) throw new Error('Invalid access token')
    ;(request as AppRequest).userId = payload.sub
    next()
  } catch {
    next(new ApiError(401, 'INVALID_ACCESS_TOKEN', 'La sesión ha expirado o no es válida.'))
  }
}

export function requestId() {
  return randomUUID()
}
