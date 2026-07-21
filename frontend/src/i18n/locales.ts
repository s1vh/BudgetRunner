export const supportedLocales = ['es-ES', 'en-US', 'fr-FR', 'de-DE', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR'] as const

export type SupportedLocale = (typeof supportedLocales)[number]

export const defaultLocale: SupportedLocale = 'en-US'
export const localeStorageKey = 'budget-runner-ui-locale'

export const localeOptions: ReadonlyArray<{ value: SupportedLocale; label: string }> = [
  { value: 'es-ES', label: 'Castellano · España' },
  { value: 'en-US', label: 'English · United States' },
  { value: 'fr-FR', label: 'Français · France' },
  { value: 'de-DE', label: 'Deutsch · Deutschland' },
  { value: 'ru-RU', label: 'Русский · Россия' },
  { value: 'zh-CN', label: '简体中文 · 中国' },
  { value: 'ja-JP', label: '日本語 · 日本' },
  { value: 'ko-KR', label: '한국어 · 대한민국' },
]

let runtimeLocale: SupportedLocale = defaultLocale

export function getRuntimeLocale() {
  return runtimeLocale
}

export function setRuntimeLocale(locale: SupportedLocale) {
  runtimeLocale = locale
}

export function resolveLocale(candidates: readonly string[] | string | null | undefined): SupportedLocale {
  const values = Array.isArray(candidates) ? candidates : candidates ? [candidates] : []
  for (const raw of values) {
    const normalized = raw.replace('_', '-').trim()
    const exact = supportedLocales.find((locale) => locale.toLowerCase() === normalized.toLowerCase())
    if (exact) return exact
    const lower = normalized.toLowerCase()
    if (lower.startsWith('zh-hant') || lower === 'zh-tw' || lower.startsWith('zh-tw-') || lower === 'zh-hk' || lower.startsWith('zh-hk-')) continue
    if (lower.startsWith('zh-hans') || lower === 'zh' || lower.startsWith('zh-cn') || lower.startsWith('zh-sg')) return 'zh-CN'
    if (lower === 'es' || lower.startsWith('es-')) return 'es-ES'
    if (lower === 'en' || lower.startsWith('en-')) return 'en-US'
    if (lower === 'fr' || lower.startsWith('fr-')) return 'fr-FR'
    if (lower === 'de' || lower.startsWith('de-')) return 'de-DE'
    if (lower === 'ru' || lower.startsWith('ru-')) return 'ru-RU'
    if (lower === 'ja' || lower.startsWith('ja-')) return 'ja-JP'
    if (lower === 'ko' || lower.startsWith('ko-')) return 'ko-KR'
  }
  return defaultLocale
}

export function detectSystemLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return defaultLocale
  return resolveLocale(navigator.languages?.length ? navigator.languages : navigator.language)
}

export function readStoredLocale(): SupportedLocale | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(localeStorageKey)
  return stored && supportedLocales.includes(stored as SupportedLocale) ? stored as SupportedLocale : null
}
