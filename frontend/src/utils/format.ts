import { getRuntimeLocale } from '@/i18n/locales'

export function formatMoney(amountMinor: number, currency = 'EUR', locale = getRuntimeLocale()) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

export function formatDate(value: string, locale = getRuntimeLocale()) {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatShortDate(value: string, locale = getRuntimeLocale()) {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }).format(new Date(value))
}

export function formatNumber(value: number, locale = getRuntimeLocale()) {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatMonth(value: string, locale = getRuntimeLocale()) {
  const date = /^\d{4}-\d{2}$/.test(value) ? new Date(`${value}-01T00:00:00Z`) : new Date(value)
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '').toLocaleUpperCase(locale)
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
