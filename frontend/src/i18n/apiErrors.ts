import { getRuntimeLocale } from './locales'
import { catalogs, type TranslationKey } from './messages'

const errorKeys: Record<string, TranslationKey> = {
  AUTHENTICATION_REQUIRED: 'error.authentication',
  INVALID_ACCESS_TOKEN: 'error.authentication',
  INVALID_REFRESH_TOKEN: 'error.authentication',
  REFRESH_TOKEN_REQUIRED: 'error.authentication',
  INVALID_CREDENTIALS: 'error.invalidCredentials',
  VALIDATION_ERROR: 'error.invalidInput',
  TRANSMISSION_REJECTED: 'error.requestFailed',
  INVALID_REFERENCE: 'error.invalidInput',
  INVALID_CATEGORY: 'error.invalidInput',
  FUTURE_TRANSACTION_MUST_BE_SCHEDULED: 'error.invalidInput',
  IDEMPOTENCY_KEY_REQUIRED: 'error.invalidInput',
  RESOURCE_CONFLICT: 'error.conflict',
  CATEGORY_NOT_FOUND: 'error.notFound',
  TRANSACTION_NOT_FOUND: 'error.notFound',
  USER_NOT_FOUND: 'error.notFound',
  MODULE_NOT_FOUND: 'error.notFound',
  PROGRESS_NOT_FOUND: 'error.notFound',
  ROUTE_NOT_FOUND: 'error.notFound',
  REWARDED_TRANSACTION_LOCKED: 'error.rewardLocked',
  INSUFFICIENT_SYNTHCOINS: 'error.insufficientCoins',
  LEVEL_TOO_LOW: 'error.levelTooLow',
  PURCHASES_LOCKED: 'error.purchasesLocked',
  OFFER_NOT_FOUND: 'error.offerUnavailable',
  OFFER_ALREADY_PURCHASED: 'error.offerUnavailable',
  OFFER_EXPIRED: 'error.offerUnavailable',
  MODULE_DESTROYED: 'error.moduleDestroyed',
  MODULE_NOT_DAMAGED: 'error.moduleNotDamaged',
  INTERNAL_ERROR: 'error.internal',
}

export function apiErrorMessage(code: string) {
  const key = errorKeys[code] ?? 'error.requestFailed'
  return catalogs[getRuntimeLocale()][key]
}

export function displayErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return catalogs[getRuntimeLocale()]['common.unexpectedError']
  return /^[A-Z][A-Z0-9_]+$/.test(error.message) ? apiErrorMessage(error.message) : error.message
}
