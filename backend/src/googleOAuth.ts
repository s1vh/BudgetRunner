import { createHash, randomBytes } from 'node:crypto'
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library'
import { config } from './config.js'
import type { DbClient } from './db.js'
import { ApiError } from './errors.js'
import { provisionNewUser } from './userProvisioning.js'

export interface GoogleIdentity {
  subject: string
  email: string
  displayName: string
  avatarUrl?: string
}

function client() {
  if (!config.googleOAuthEnabled) {
    throw new ApiError(503, 'GOOGLE_OAUTH_NOT_CONFIGURED', 'Google OAuth todavía no está configurado.')
  }
  return new OAuth2Client({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    redirectUri: config.googleRedirectUri,
  })
}

export function createGoogleAuthorizationRequest() {
  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')
  const codeVerifier = randomBytes(48).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const url = client().generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  })
  return { state, nonce, codeVerifier, url }
}

export async function exchangeGoogleCode(code: string, codeVerifier: string, expectedNonce: string): Promise<GoogleIdentity> {
  const oauthClient = client()
  const { tokens } = await oauthClient.getToken({ code, codeVerifier })
  if (!tokens.id_token) throw new ApiError(401, 'GOOGLE_ID_TOKEN_MISSING', 'Google no ha devuelto una identidad válida.')
  const ticket = await oauthClient.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId })
  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new ApiError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'La cuenta de Google debe tener un email verificado.')
  }
  if (!payload.nonce || payload.nonce !== expectedNonce) {
    throw new ApiError(401, 'GOOGLE_NONCE_MISMATCH', 'La respuesta de Google no pertenece a esta solicitud.')
  }
  return {
    subject: payload.sub,
    email: payload.email.trim().toLowerCase(),
    displayName: payload.name?.trim() || payload.email.split('@')[0] || 'Nómada',
    ...(payload.picture ? { avatarUrl: payload.picture } : {}),
  }
}

export async function findOrCreateGoogleUser(client: DbClient, identity: GoogleIdentity) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`google:${identity.subject}`])
  const linked = await client.query<{ user_id: string }>(`
    SELECT oa.user_id FROM oauth_accounts oa
    JOIN users u ON u.id = oa.user_id
    WHERE oa.provider = 'google' AND oa.provider_subject = $1 AND u.deleted_at IS NULL
  `, [identity.subject])
  const linkedUserId = linked.rows[0]?.user_id
  if (linkedUserId) {
    await client.query(`
      UPDATE users SET email_verified_at = coalesce(email_verified_at, now()),
        avatar_url = coalesce(avatar_url, $2)
      WHERE id = $1
    `, [linkedUserId, identity.avatarUrl ?? null])
    return linkedUserId
  }

  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL FOR UPDATE',
    [identity.email],
  )
  let userId = existing.rows[0]?.id
  if (userId) {
    await client.query(`
      UPDATE users SET email_verified_at = coalesce(email_verified_at, now()),
        avatar_url = coalesce(avatar_url, $2)
      WHERE id = $1
    `, [userId, identity.avatarUrl ?? null])
  } else {
    const created = await client.query<{ id: string }>(`
      INSERT INTO users (email, password_hash, display_name, avatar_url, email_verified_at)
      VALUES ($1, null, $2, $3, now()) RETURNING id
    `, [identity.email, identity.displayName, identity.avatarUrl ?? null])
    userId = created.rows[0]?.id
    if (!userId) throw new Error('Google user insert failed')
    await provisionNewUser(client, userId)
  }

  await client.query(`
    INSERT INTO oauth_accounts (user_id, provider, provider_subject, email)
    VALUES ($1, 'google', $2, $3)
  `, [userId, identity.subject, identity.email])
  return userId
}
