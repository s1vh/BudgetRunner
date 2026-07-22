import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(4),
  FRONTEND_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),
  ACCESS_TOKEN_SECRET: z.string().min(32).default('local-access-token-secret-change-me'),
  REFRESH_TOKEN_SECRET: z.string().min(32).default('local-refresh-token-secret-change-me'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  GOOGLE_CLIENT_ID: z.string().trim().default(''),
  GOOGLE_CLIENT_SECRET: z.string().trim().default(''),
  GOOGLE_REDIRECT_URI: z.string().trim().default(''),
  GOOGLE_OAUTH_STATE_SECRET: z.string().trim().default(''),
  FIREBASE_AUTH_ENABLED: z.enum(['true', 'false']).default('false'),
  FIREBASE_PROJECT_ID: z.string().trim().default(''),
  CRON_SECRET: z.string().trim().default(''),
}).superRefine((env, context) => {
  if (env.FIREBASE_AUTH_ENABLED === 'true' && !env.FIREBASE_PROJECT_ID) {
    context.addIssue({ code: 'custom', path: ['FIREBASE_PROJECT_ID'], message: 'FIREBASE_PROJECT_ID is required when Firebase Auth is enabled.' })
  }
  if (env.NODE_ENV === 'production' && env.CRON_SECRET.length < 20) {
    context.addIssue({ code: 'custom', path: ['CRON_SECRET'], message: 'CRON_SECRET must contain at least 20 characters in production.' })
  }
})

const env = schema.parse(process.env)

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  dbPoolMax: env.DB_POOL_MAX,
  frontendOrigins: env.FRONTEND_ORIGINS.split(',').map((origin) => origin.trim()),
  accessTokenSecret: env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
  accessTokenTtl: env.ACCESS_TOKEN_TTL,
  refreshTokenDays: env.REFRESH_TOKEN_DAYS,
  cookieSecure: env.COOKIE_SECURE === 'true',
  frontendUrl: env.FRONTEND_URL.replace(/\/$/, ''),
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: env.GOOGLE_REDIRECT_URI,
  googleOAuthStateSecret: env.GOOGLE_OAUTH_STATE_SECRET || env.REFRESH_TOKEN_SECRET,
  googleOAuthEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI),
  firebaseAuthEnabled: env.FIREBASE_AUTH_ENABLED === 'true',
  firebaseProjectId: env.FIREBASE_PROJECT_ID,
  cronSecret: env.CRON_SECRET,
} as const
