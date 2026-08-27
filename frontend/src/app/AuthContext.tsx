/* eslint-disable react-refresh/only-export-components -- provider and hook share one module intentionally */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { apiClient } from '@/services/apiClient'
import { useI18n } from '@/i18n/I18nContext'
import type { SupportedLocale } from '@/i18n/locales'
import { FullPageLoader } from '@/components/routing/AsyncBoundary'
import { clearProfileBootstrap, primeProfileBootstrap } from '@/services/profileBootstrap'
import type { UserProfile } from '@/types/domain'

interface AuthUser { id: string; email: string; displayName: string }
interface RegisterInput { email: string; password: string; displayName: string; currency: string; timezone: string; locale: SupportedLocale }
interface AuthValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  completeGoogleLogin: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)
const usesApi = import.meta.env.VITE_DATA_SOURCE === 'api'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [user, setUser] = useState<AuthUser | null>(usesApi ? null : { id: 'mock-user', email: 'mock@local', displayName: 'Nómada' })
  const [loading, setLoading] = useState(usesApi)

  useEffect(() => {
    if (!usesApi) return
    let active = true
    async function restore() {
      try {
        if (!apiClient.hasAccessToken() && !await apiClient.refresh()) {
          clearProfileBootstrap()
          return
        }
        const current = await apiClient.request<UserProfile>('/me')
        if (active) {
          primeProfileBootstrap(current)
          setUser(current)
        }
      } catch {
        apiClient.setAccessToken(null)
        clearProfileBootstrap()
      } finally {
        if (active) setLoading(false)
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(email, password) {
      if (!usesApi) { setUser({ id: 'mock-user', email, displayName: 'Nómada' }); return }
      clearProfileBootstrap()
      const result = await apiClient.request<{ accessToken: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      apiClient.setAccessToken(result.accessToken)
      setUser(result.user)
    },
    async register(input) {
      if (!usesApi) { setUser({ id: 'mock-user', email: input.email, displayName: input.displayName }); return }
      clearProfileBootstrap()
      const result = await apiClient.request<{ accessToken: string; user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
      apiClient.setAccessToken(result.accessToken)
      setUser(result.user)
    },
    async completeGoogleLogin() {
      if (!usesApi) { setUser({ id: 'mock-google-user', email: 'google@local', displayName: 'Nómada Google' }); return }
      if (!await apiClient.refresh()) throw new Error(t('auth.google.failed'))
      const current = await apiClient.request<UserProfile>('/me')
      primeProfileBootstrap(current)
      setUser(current)
    },
    async logout() {
      if (usesApi) await apiClient.request<void>('/auth/logout', { method: 'POST' }).catch(() => undefined)
      apiClient.setAccessToken(null)
      clearProfileBootstrap()
      setUser(null)
    },
  }), [loading, t, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader labelKey="loading.identity" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
