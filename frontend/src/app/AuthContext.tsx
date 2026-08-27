/* eslint-disable react-refresh/only-export-components -- provider and hook share one module intentionally */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { confirmPasswordReset as confirmFirebasePasswordReset, createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, verifyPasswordResetCode as verifyFirebasePasswordResetCode } from 'firebase/auth'
import { FullPageLoader } from '@/components/routing/AsyncBoundary'
import { firebaseAuth } from '@/firebase'
import type { SupportedLocale } from '@/i18n/locales'
import { enforceSafeUserInput } from '@/security/securityReset'
import { apiClient } from '@/services/apiClient'
import { clearProfileBootstrap, primeProfileBootstrap } from '@/services/profileBootstrap'
import type { UserProfile } from '@/types/domain'

interface AuthUser { id: string; email: string; displayName: string }
interface RegisterInput { email: string; password: string; displayName: string; currency: string; timezone: string; locale: SupportedLocale }
interface AuthValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  loginWithGoogle: () => Promise<void>
  completeGoogleLogin: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  verifyPasswordReset: (code: string) => Promise<string>
  confirmPasswordReset: (code: string, newPassword: string) => Promise<void>
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
    const unsubscribe = onAuthStateChanged(firebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        clearProfileBootstrap()
        if (active) { setUser(null); setLoading(false) }
        return
      }
      try {
        const current = await apiClient.request<UserProfile>('/me')
        if (active) {
          primeProfileBootstrap(current)
          setUser(current)
        }
      } catch {
        clearProfileBootstrap()
        if (active) setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false; unsubscribe() }
  }, [])

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(email, password) {
      enforceSafeUserInput({ email, password })
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email, displayName: 'Nómada' }); return }
      clearProfileBootstrap()
      await signInWithEmailAndPassword(firebaseAuth(), email, password)
      const current = await apiClient.request<UserProfile>('/me')
      primeProfileBootstrap(current)
      setUser(current)
    },
    async register(input) {
      enforceSafeUserInput(input)
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email: input.email, displayName: input.displayName }); return }
      clearProfileBootstrap()
      const credential = await createUserWithEmailAndPassword(firebaseAuth(), input.email, input.password)
      await updateProfile(credential.user, { displayName: input.displayName })
      const result = await apiClient.request<{ user: UserProfile }>('/auth/bootstrap', { method: 'POST', body: JSON.stringify(input) })
      primeProfileBootstrap(result.user)
      setUser(result.user)
    },
    async loginWithGoogle() {
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email: 'anonimo@budgetrunner.local', displayName: 'Nómada' }); return }
      clearProfileBootstrap()
      await signInWithPopup(firebaseAuth(), new GoogleAuthProvider())
      const current = await apiClient.request<UserProfile>('/me')
      primeProfileBootstrap(current)
      setUser(current)
    },
    async completeGoogleLogin() {
      if (!usesApi) { setUser({ id: 'anonymous-mock-user', email: 'anonimo@budgetrunner.local', displayName: 'Nómada' }); return }
      if (!firebaseAuth().currentUser) throw new Error('No existe una sesión de Google activa.')
      const current = await apiClient.request<UserProfile>('/me')
      primeProfileBootstrap(current)
      setUser(current)
    },
    async requestPasswordReset(email) {
      enforceSafeUserInput(email)
      if (!usesApi) return
      await sendPasswordResetEmail(firebaseAuth(), email, { url: `${window.location.origin}/login` })
    },
    async verifyPasswordReset(code) {
      if (!usesApi) return 'nomada@budgetrunner.local'
      return verifyFirebasePasswordResetCode(firebaseAuth(), code)
    },
    async confirmPasswordReset(code, newPassword) {
      enforceSafeUserInput(newPassword)
      if (!usesApi) return
      await confirmFirebasePasswordReset(firebaseAuth(), code, newPassword)
    },
    async logout() {
      if (usesApi) await signOut(firebaseAuth())
      clearProfileBootstrap()
      setUser(null)
    },
  }), [loading, user])

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
