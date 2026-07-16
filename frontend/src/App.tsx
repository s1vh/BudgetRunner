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

export function App() {
  return (
    <Routes>
      <Route element={<RequireAuth><AppDataProvider><AppShell /></AppDataProvider></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="gastos" element={<TransactionsPage />} />
        <Route path="presupuestos" element={<BudgetsPage />} />
        <Route path="gamificacion" element={<GamePage />} />
        <Route path="perfil" element={<ProfilePage />} />
        <Route path="ajustes" element={<SettingsPage />} />
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
