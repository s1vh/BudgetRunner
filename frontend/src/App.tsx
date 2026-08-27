import { lazy } from 'react'
import { Route, Routes } from 'react-router'
import { RequireAuth } from '@/app/AuthContext'
import { PublicShell } from '@/components/layout/PublicShell'
import { ErrorPage, ForgotPasswordPage, LoginPage, OAuthCallbackPage, RegisterPage, ResetPasswordPage } from '@/pages/AuthPages'
import { LicensePage, PrivacyPage } from '@/pages/LegalPages'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AsyncBoundary, FullPageLoader } from '@/components/routing/AsyncBoundary'
import { SecurityResetNotice } from '@/components/security/SecurityResetNotice'

const loadFinancialPages = () => import('@/features/finance/FinancialPages')
const loadAccountPages = () => import('@/features/account/AccountPages')

const ProtectedLayout = lazy(() => import('@/app/ProtectedLayout').then((module) => ({ default: module.ProtectedLayout })))
const DashboardPage = lazy(() => loadFinancialPages().then((module) => ({ default: module.DashboardPage })))
const TransactionsPage = lazy(() => loadFinancialPages().then((module) => ({ default: module.TransactionsPage })))
const BudgetsPage = lazy(() => loadFinancialPages().then((module) => ({ default: module.BudgetsPage })))
const ProfilePage = lazy(() => loadAccountPages().then((module) => ({ default: module.ProfilePage })))
const SettingsPage = lazy(() => loadAccountPages().then((module) => ({ default: module.SettingsPage })))
const GamePage = lazy(() => import('@/pages/GamePage').then((module) => ({ default: module.GamePage })))

export function App() {
  return (
    <>
      <SecurityResetNotice />
      <Routes>
        <Route element={<RequireAuth><AsyncBoundary mode="screen" fallback={<FullPageLoader />}><ProtectedLayout /></AsyncBoundary></RequireAuth>}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="gamification" element={<GamePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route element={<PublicShell />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="registro" element={<RegisterPage />} />
          <Route path="recuperar" element={<ForgotPasswordPage />} />
          <Route path="restablecer" element={<ResetPasswordPage />} />
          <Route path="oauth/callback" element={<OAuthCallbackPage />} />
          <Route path="licencia" element={<LicensePage />} />
          <Route path="privacidad" element={<PrivacyPage />} />
          <Route path="error" element={<ErrorPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}
