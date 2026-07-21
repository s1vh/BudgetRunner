import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Globe as Chrome, KeyRound, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button, Field, Input, SynthCard } from '@/components/ui/primitives'
import { apiUrl } from '@/services/apiClient'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'

function AuthCard({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return <SynthCard className="w-full max-w-md p-6 sm:p-8"><p className="font-mono text-[10px] tracking-[0.16em] text-neon-cyan uppercase">{eyebrow}</p><h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 text-sm leading-6 text-text-muted">{description}</p><div className="mt-7">{children}</div>{footer && <div className="mt-6 border-t border-outline-soft/50 pt-5 text-center text-sm text-text-muted">{footer}</div>}</SynthCard>
}

function startGoogleOAuth(locale: string) {
  window.location.assign(`${apiUrl('/auth/google')}?locale=${encodeURIComponent(locale)}`)
}

const googleOAuthEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true'

const oauthErrorKeys: Record<string, TranslationKey> = {
  google_not_configured: 'auth.google.notConfigured',
  access_denied: 'auth.google.accessDenied',
  invalid_oauth_callback: 'auth.google.invalidCallback',
  invalid_oauth_state: 'auth.google.invalidState',
  google_exchange_failed: 'auth.google.exchangeFailed',
  google_rejected: 'auth.google.rejected',
}

export function LoginPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('nomada@budgetrunner.local')
  const [password, setPassword] = useState('NeonRunner!2026')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.loginFailed'))
    } finally { setBusy(false) }
  }

  return <AuthCard eyebrow={t('auth.login.eyebrow')} title={t('auth.login.title')} description={t('auth.login.description')} footer={<>{t('auth.firstTransmission')} <Link to="/registro" className="text-neon-cyan hover:underline">{t('auth.createAccount')}</Link></>}>
    <form className="grid gap-5" onSubmit={submit}>
      {error && <div role="alert" className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/7 p-3 text-sm text-neon-magenta">{error}</div>}
      <Field label={t('auth.email')} htmlFor="login-email" required><Input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>
      <Field label={t('auth.password')} htmlFor="login-password" required><Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></Field>
      <div className="flex items-center justify-between text-xs"><span className="text-text-muted">{t('auth.refreshActive')}</span><Link to="/recuperar" className="text-tertiary hover:underline">{t('auth.forgot')}</Link></div>
      <Button type="submit" className="w-full" icon={ArrowRight} loading={busy}>{t('auth.enter')}</Button>
      <Button type="button" className="w-full" variant="ghost" icon={Chrome} onClick={googleOAuthEnabled ? () => startGoogleOAuth(locale) : undefined} disabled={!googleOAuthEnabled} title={googleOAuthEnabled ? t('auth.google.continue') : t('auth.google.disabled')}>{googleOAuthEnabled ? t('auth.google.continue') : t('auth.google.soon')}</Button>
    </form>
  </AuthCard>
}

export function RegisterPage() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { register } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await register({
        displayName: String(form.get('displayName') ?? ''),
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        currency: String(form.get('currency') ?? 'EUR'),
        timezone: String(form.get('timezone') ?? 'Europe/Madrid'),
        locale,
      })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('auth.registerFailed'))
    } finally { setBusy(false) }
  }

  return <AuthCard eyebrow={t('auth.register.eyebrow')} title={t('auth.register.title')} description={t('auth.register.description')} footer={<>{t('auth.haveIdentity')} <Link to="/login" className="text-neon-cyan hover:underline">{t('auth.signIn')}</Link></>}>
    <form className="grid gap-5" onSubmit={submit}>
      {error && <div role="alert" className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/7 p-3 text-sm text-neon-magenta">{error}</div>}
      <Field label={t('auth.displayName')} htmlFor="register-name" required><Input id="register-name" name="displayName" placeholder={t('nav.nomad')} autoComplete="name" required /></Field>
      <Field label={t('auth.email')} htmlFor="register-email" required><Input id="register-email" name="email" type="email" placeholder="nomad@nexus.local" autoComplete="email" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label={t('auth.currency')} htmlFor="register-currency"><select id="register-currency" name="currency" className="form-control"><option>EUR</option><option>USD</option></select></Field><Field label={t('auth.timezone')} htmlFor="register-timezone"><select id="register-timezone" name="timezone" className="form-control"><option>Europe/Madrid</option><option>UTC</option></select></Field></div>
      <Field label={t('auth.password')} htmlFor="register-password" hint={t('auth.passwordHint')} required><Input id="register-password" name="password" type="password" minLength={10} autoComplete="new-password" required /></Field>
      <Button className="w-full" icon={UserPlus} loading={busy}>{t('auth.createIdentity')}</Button>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-text-muted"><i className="h-px flex-1 bg-outline-soft/60" />{t('auth.or')}<i className="h-px flex-1 bg-outline-soft/60" /></div>
      <Button type="button" className="w-full" variant="ghost" icon={Chrome} onClick={googleOAuthEnabled ? () => startGoogleOAuth(locale) : undefined} disabled={busy || !googleOAuthEnabled} title={googleOAuthEnabled ? t('auth.google.continue') : t('auth.google.disabled')}>{googleOAuthEnabled ? t('auth.google.continue') : t('auth.google.soon')}</Button>
    </form>
  </AuthCard>
}

export function ForgotPasswordPage() {
  const { t } = useI18n()
  const [sent, setSent] = useState(false)
  return <AuthCard eyebrow={t('auth.recovery.eyebrow')} title={t('auth.recovery.title')} description={t('auth.recovery.description')} footer={<Link to="/login" className="text-neon-cyan hover:underline">{t('auth.backToLogin')}</Link>}>{sent ? <div className="rounded-lg border border-success/25 bg-success/5 p-5 text-center"><Mail className="mx-auto mb-3 size-6 text-success" /><strong className="block text-success">{t('auth.requestRecorded')}</strong><p className="mt-2 text-sm text-text-muted">{t('auth.mailUnavailable')}</p></div> : <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><Field label={t('auth.email')} htmlFor="forgot-email" required><Input id="forgot-email" type="email" placeholder="nomad@nexus.local" /></Field><Button icon={Mail} className="w-full">{t('auth.requestLink')}</Button></form>}</AuthCard>
}

export function ResetPasswordPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return <AuthCard eyebrow={t('auth.reset.eyebrow')} title={t('auth.reset.title')} description={t('auth.reset.description')}><form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); navigate('/login') }}><Field label={t('auth.newPassword')} htmlFor="reset-password" required><Input id="reset-password" type="password" autoComplete="new-password" /></Field><Field label={t('auth.confirmation')} htmlFor="reset-confirm" required><Input id="reset-confirm" type="password" autoComplete="new-password" /></Field><Button className="w-full" icon={KeyRound}>{t('auth.backToLogin')}</Button></form></AuthCard>
}

export function OAuthCallbackPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { completeGoogleLogin } = useAuth()
  const attempted = useRef(false)
  const providerError = new URLSearchParams(location.search).get('error')
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const error = providerError ? t(oauthErrorKeys[providerError] ?? 'auth.google.failed') : callbackError

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    if (providerError) return
    completeGoogleLogin()
      .then(() => navigate('/', { replace: true }))
      .catch((caught: unknown) => setCallbackError(caught instanceof Error ? caught.message : t('auth.google.failed')))
  }, [completeGoogleLogin, navigate, providerError, t])

  return <AuthCard eyebrow={t('auth.oauth.eyebrow')} title={error ? t('auth.oauth.interrupted') : t('auth.oauth.syncing')} description={error ?? t('auth.oauth.validating')}><div className="grid gap-5 text-center">{error ? <LockKeyhole className="mx-auto size-14 text-neon-magenta" /> : <ShieldCheck className="mx-auto size-14 animate-pulse text-tertiary" />}<Button className="w-full" variant={error ? 'ghost' : 'cyan'} icon={error ? ArrowRight : ShieldCheck} disabled={!error} onClick={() => navigate('/login')}>{error ? t('auth.backToLogin') : t('auth.oauth.verifying')}</Button></div></AuthCard>
}

export function ErrorPage() {
  const { t } = useI18n()
  return <AuthCard eyebrow={t('auth.error.eyebrow')} title={t('auth.syncFailed')} description={t('auth.offline')}><div className="grid gap-4 text-center"><LockKeyhole className="mx-auto size-12 text-neon-magenta" /><Button onClick={() => window.location.reload()}>{t('auth.retryConnection')}</Button></div></AuthCard>
}
