/* eslint-disable react-refresh/only-export-components -- provider and hook intentionally share this module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { catalogs, translationKeySet, type TranslationKey } from './messages'
import type { LocalizedMessage } from '@/types/domain'
import {
  defaultLocale,
  detectSystemLocale,
  localeStorageKey,
  readStoredLocale,
  resolveLocale,
  setRuntimeLocale,
  type SupportedLocale,
} from './locales'

export type TranslationParams = Record<string, string | number>

interface I18nValue {
  locale: SupportedLocale
  t: (key: TranslationKey, params?: TranslationParams) => string
  td: (message: LocalizedMessage | string) => string
  setLocale: (locale: SupportedLocale, persist?: boolean) => void
  syncProfileLocale: (locale: string) => void
}

const I18nContext = createContext<I18nValue | null>(null)

function interpolate(message: string, params?: TranslationParams) {
  if (!params) return message
  return message.replace(/\{(\w+)\}/g, (match, key: string) => params[key] === undefined ? match : String(params[key]))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => readStoredLocale() ?? detectSystemLocale())

  const setLocale = useCallback((next: SupportedLocale, persist = true) => {
    setLocaleState(next)
    if (persist) window.localStorage.setItem(localeStorageKey, next)
  }, [])

  const syncProfileLocale = useCallback((profileLocale: string) => {
    const next = resolveLocale(profileLocale)
    setLocaleState(next)
    window.localStorage.setItem(localeStorageKey, next)
  }, [])

  useEffect(() => {
    setRuntimeLocale(locale)
    document.documentElement.lang = locale
    document.documentElement.dataset.locale = locale
    document.title = 'Budget Runner'
    document.querySelector('meta[name="description"]')?.setAttribute('content', catalogs[locale]['app.description'])
  }, [locale])

  const t = useCallback((key: TranslationKey, params?: TranslationParams) => {
    const message = catalogs[locale]?.[key] ?? catalogs[defaultLocale][key] ?? key
    return interpolate(message, params)
  }, [locale])

  const td = useCallback((message: LocalizedMessage | string) => {
    if (typeof message === 'string') return message
    if (!translationKeySet.has(message.key)) return message.fallback ?? message.key
    return t(message.key as TranslationKey, message.params)
  }, [t])

  const value = useMemo(() => ({ locale, t, td, setLocale, syncProfileLocale }), [locale, setLocale, syncProfileLocale, t, td])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider.')
  return context
}
