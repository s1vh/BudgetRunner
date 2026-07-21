import { Route, Routes } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { AppDataProvider } from '@/app/AppDataContext'
import { RequireAuth } from '@/app/AuthContext'
import { PublicShell } from '@/components/layout/PublicShell'
import { BudgetsPage } from '@/pages/BudgetsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { GamePage } from '@/pages/GamePage'
import { ProfilePage } from '@/pages/ProfilePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'
import { ErrorPage, ForgotPasswordPage, LoginPage, OAuthCallbackPage, RegisterPage, ResetPasswordPage } from '@/pages/AuthPages'
import { LicensePage, PrivacyPage } from '@/pages/LegalPages'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { HelpCenterProvider } from '@/components/help/HelpCenterContext'

export function App() {
  return (
    <Routes>
      <Route element={<RequireAuth><AppDataProvider><HelpCenterProvider><AppShell /></HelpCenterProvider></AppDataProvider></RequireAuth>}>
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
  )
}
