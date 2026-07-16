/* eslint-disable react-refresh/only-export-components -- provider and hook share one module intentionally */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { apiClient } from '@/services/apiClient'

interface AuthUser { id: string; email: string; displayName: string }
interface RegisterInput { email: string; password: string; displayName: string; currency: string; timezone: string }
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
  const [user, setUser] = useState<AuthUser | null>(usesApi ? null : { id: 'anonymous-mock-user', email: 'anonimo@budgetrunner.local', displayName: 'Nómada' })
  const [loading, setLoading] = useState(usesApi)

  useEffect(() => {
    if (!usesApi) return
    let active = true
    async function restore() {
      try {
        if (!apiClient.hasAccessToken() && !await apiClient.refresh()) return
        const current = await apiClient.request<AuthUser>('/me')
        if (active) setUser(current)
      } catch {
        apiClient.setAccessToken(null)
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
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email, displayName: 'Nómada' }); return }
      const result = await apiClient.request<{ accessToken: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      apiClient.setAccessToken(result.accessToken)
      setUser(result.user)
    },
    async register(input) {
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email: input.email, displayName: 'Nómada' }); return }
      const result = await apiClient.request<{ accessToken: string; user: AuthUser }>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
      apiClient.setAccessToken(result.accessToken)
      setUser(result.user)
    },
    async completeGoogleLogin() {
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email: 'anonimo@budgetrunner.local', displayName: 'Nómada' }); return }
      if (!await apiClient.refresh()) throw new Error('No se ha podido crear la sesión de Google.')
      const current = await apiClient.request<AuthUser>('/me')
      setUser(current)
    },
    async logout() {
      if (usesApi) await apiClient.request<void>('/auth/logout', { method: 'POST' }).catch(() => undefined)
      apiClient.setAccessToken(null)
      setUser(null)
    },
  }), [loading, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  return context
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid min-h-screen place-items-center font-mono text-neon-cyan">SINCRONIZANDO IDENTIDAD…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
