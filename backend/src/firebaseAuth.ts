import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth'
import { config } from './config.js'
import type { DbClient } from './db.js'
import { ApiError } from './errors.js'
import { provisionNewUser } from './userProvisioning.js'

function firebaseAuth() {
  if (!config.firebaseProjectId) {
    throw new Error('Firebase project ID is not configured.')
  }
  // ID-token verification only needs the Firebase project ID and Google's
  // public signing keys. Keeping a service-account private key in Vercel is
  // unnecessary for this API because it does not call privileged Firebase APIs.
  const app = getApps()[0] ?? initializeApp({ projectId: config.firebaseProjectId })
  return getAuth(app)
}

export async function verifyFirebaseToken(token: string) {
  try {
    return await firebaseAuth().verifyIdToken(token)
  } catch {
    throw new ApiError(401, 'INVALID_FIREBASE_TOKEN', 'La sesión ha expirado o no es válida.')
  }
}

export async function findOrCreateFirebaseUser(client: DbClient, identity: DecodedIdToken) {
  const email = identity.email?.trim().toLowerCase()
  if (!email) throw new ApiError(401, 'FIREBASE_EMAIL_REQUIRED', 'La cuenta de Firebase no contiene un email.')

  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`firebase:${identity.uid}`])
  const linked = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE firebase_uid = $1 AND deleted_at IS NULL FOR UPDATE',
    [identity.uid],
  )
  if (linked.rows[0]) {
    await client.query(`UPDATE users SET email_verified_at = CASE WHEN $2 THEN coalesce(email_verified_at, now()) ELSE email_verified_at END,
      avatar_url = coalesce($3, avatar_url) WHERE id = $1`, [linked.rows[0].id, identity.email_verified === true, identity.picture ?? null])
    await linkGoogleProvider(client, linked.rows[0].id, identity, email)
    return linked.rows[0].id
  }

  const sameEmail = await client.query<{ id: string; firebase_uid: string | null }>(
    'SELECT id, firebase_uid FROM users WHERE email = $1 AND deleted_at IS NULL FOR UPDATE',
    [email],
  )
  if (sameEmail.rows[0]) {
    if (sameEmail.rows[0].firebase_uid && sameEmail.rows[0].firebase_uid !== identity.uid) {
      throw new ApiError(409, 'FIREBASE_ACCOUNT_CONFLICT', 'El email ya está vinculado a otra cuenta.')
    }
    if (!identity.email_verified) {
      throw new ApiError(409, 'EMAIL_VERIFICATION_REQUIRED', 'Verifica el email antes de vincular esta cuenta.')
    }
    await client.query(`UPDATE users SET firebase_uid = $2, email_verified_at = coalesce(email_verified_at, now()),
      avatar_url = coalesce($3, avatar_url) WHERE id = $1`, [sameEmail.rows[0].id, identity.uid, identity.picture ?? null])
    await linkGoogleProvider(client, sameEmail.rows[0].id, identity, email)
    return sameEmail.rows[0].id
  }

  const displayName = String(identity.name ?? email.split('@')[0] ?? 'Nómada').slice(0, 80)
  const inserted = await client.query<{ id: string }>(`
    INSERT INTO users (firebase_uid, email, display_name, avatar_url, email_verified_at)
    VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN now() ELSE NULL END)
    RETURNING id
  `, [identity.uid, email, displayName, identity.picture ?? null, identity.email_verified === true])
  const userId = inserted.rows[0]?.id
  if (!userId) throw new Error('Firebase user insert failed')
  await provisionNewUser(client, userId)
  await linkGoogleProvider(client, userId, identity, email)
  return userId
}

async function linkGoogleProvider(client: DbClient, userId: string, identity: DecodedIdToken, email: string) {
  if (identity.firebase?.sign_in_provider !== 'google.com') return
  await client.query(`
    INSERT INTO oauth_accounts (user_id, provider, provider_subject, email)
    VALUES ($1, 'google', $2, $3)
    ON CONFLICT (provider, provider_subject) DO UPDATE SET email = EXCLUDED.email
  `, [userId, identity.uid, email])
}
