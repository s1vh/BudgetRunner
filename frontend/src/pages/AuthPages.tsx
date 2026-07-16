import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Globe as Chrome, KeyRound, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button, Field, Input, SynthCard } from '@/components/ui/primitives'
import { apiUrl } from '@/services/apiClient'

function AuthCard({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return <SynthCard className="w-full max-w-md p-6 sm:p-8"><p className="font-mono text-[10px] tracking-[0.16em] text-neon-cyan uppercase">{eyebrow}</p><h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 text-sm leading-6 text-text-muted">{description}</p><div className="mt-7">{children}</div>{footer && <div className="mt-6 border-t border-outline-soft/50 pt-5 text-center text-sm text-text-muted">{footer}</div>}</SynthCard>
}

function startGoogleOAuth() {
  window.location.assign(apiUrl('/auth/google'))
}

const googleOAuthEnabled = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true'

const oauthErrorMessages: Record<string, string> = {
  google_not_configured: 'Google OAuth está implementado, pero faltan las credenciales del proyecto en la API.',
  access_denied: 'Has cancelado el acceso con Google. No se ha creado ninguna sesión.',
  invalid_oauth_callback: 'La respuesta de Google está incompleta. Inicia el proceso de nuevo.',
  invalid_oauth_state: 'La solicitud ha caducado o no supera la validación de seguridad.',
  google_exchange_failed: 'Google no ha podido validar la identidad. Inténtalo de nuevo.',
  google_rejected: 'Google ha rechazado la solicitud de acceso.',
}

export function LoginPage() {
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
      setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.')
    } finally { setBusy(false) }
  }

  return <AuthCard eyebrow="Acceso seguro" title="Conecta con tu ciclo" description="Inicia una sesión JWT contra la API y sincroniza tus datos desde PostgreSQL." footer={<>¿Primera transmisión? <Link to="/registro" className="text-neon-cyan hover:underline">Crear cuenta</Link></>}>
    <form className="grid gap-5" onSubmit={submit}>
      {error && <div role="alert" className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/7 p-3 text-sm text-neon-magenta">{error}</div>}
      <Field label="Email" htmlFor="login-email" required><Input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>
      <Field label="Contraseña" htmlFor="login-password" required><Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></Field>
      <div className="flex items-center justify-between text-xs"><span className="text-text-muted">Refresh seguro activado</span><Link to="/recuperar" className="text-tertiary hover:underline">¿Olvidaste la clave?</Link></div>
      <Button type="submit" className="w-full" icon={ArrowRight} loading={busy}>Entrar al sistema</Button>
      <Button type="button" className="w-full" variant="ghost" icon={Chrome} onClick={googleOAuthEnabled ? startGoogleOAuth : undefined} disabled={!googleOAuthEnabled} title={googleOAuthEnabled ? 'Continuar con Google' : 'Google OAuth se habilitará después del MVP'}>{googleOAuthEnabled ? 'Continuar con Google' : 'Google OAuth · próximamente'}</Button>
    </form>
  </AuthCard>
}

export function RegisterPage() {
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
      })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la identidad.')
    } finally { setBusy(false) }
  }

  return <AuthCard eyebrow="Nueva identidad" title="Únete a la red" description="La API creará un usuario aislado, categorías personales, progreso nivel 1 y saldo SynthCoin cero." footer={<>¿Ya tienes identidad? <Link to="/login" className="text-neon-cyan hover:underline">Iniciar sesión</Link></>}>
    <form className="grid gap-5" onSubmit={submit}>
      {error && <div role="alert" className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/7 p-3 text-sm text-neon-magenta">{error}</div>}
      <Field label="Nombre visible" htmlFor="register-name" required><Input id="register-name" name="displayName" placeholder="Nómada" autoComplete="name" required /></Field>
      <Field label="Email" htmlFor="register-email" required><Input id="register-email" name="email" type="email" placeholder="nomada@nexus.local" autoComplete="email" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Moneda" htmlFor="register-currency"><select id="register-currency" name="currency" className="form-control"><option>EUR</option><option>USD</option></select></Field><Field label="Zona" htmlFor="register-timezone"><select id="register-timezone" name="timezone" className="form-control"><option>Europe/Madrid</option><option>UTC</option></select></Field></div>
      <Field label="Contraseña" htmlFor="register-password" hint="Mínimo 10 caracteres." required><Input id="register-password" name="password" type="password" minLength={10} autoComplete="new-password" required /></Field>
      <Button className="w-full" icon={UserPlus} loading={busy}>Crear identidad</Button>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-text-muted"><i className="h-px flex-1 bg-outline-soft/60" />o<i className="h-px flex-1 bg-outline-soft/60" /></div>
      <Button type="button" className="w-full" variant="ghost" icon={Chrome} onClick={googleOAuthEnabled ? startGoogleOAuth : undefined} disabled={busy || !googleOAuthEnabled} title={googleOAuthEnabled ? 'Crear cuenta con Google' : 'Google OAuth se habilitará después del MVP'}>{googleOAuthEnabled ? 'Crear cuenta con Google' : 'Google OAuth · próximamente'}</Button>
    </form>
  </AuthCard>
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  return <AuthCard eyebrow="Recuperación" title="Restaurar acceso" description="La recuperación por email se conectará en la siguiente fase de identidad." footer={<Link to="/login" className="text-neon-cyan hover:underline">Volver al acceso</Link>}>{sent ? <div className="rounded-lg border border-success/25 bg-success/5 p-5 text-center"><Mail className="mx-auto mb-3 size-6 text-success" /><strong className="block text-success">Solicitud registrada</strong><p className="mt-2 text-sm text-text-muted">El canal de correo todavía no está habilitado en desarrollo.</p></div> : <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><Field label="Email" htmlFor="forgot-email" required><Input id="forgot-email" type="email" placeholder="nomada@nexus.local" /></Field><Button icon={Mail} className="w-full">Solicitar enlace</Button></form>}</AuthCard>
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  return <AuthCard eyebrow="Token requerido" title="Nueva contraseña" description="El endpoint de recuperación se habilitará junto con el proveedor de correo."><form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); navigate('/login') }}><Field label="Nueva contraseña" htmlFor="reset-password" required><Input id="reset-password" type="password" autoComplete="new-password" /></Field><Field label="Confirmación" htmlFor="reset-confirm" required><Input id="reset-confirm" type="password" autoComplete="new-password" /></Field><Button className="w-full" icon={KeyRound}>Volver al acceso</Button></form></AuthCard>
}

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { completeGoogleLogin } = useAuth()
  const attempted = useRef(false)
  const providerError = new URLSearchParams(location.search).get('error')
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const error = providerError ? (oauthErrorMessages[providerError] ?? 'No se ha podido completar el acceso con Google.') : callbackError

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    if (providerError) return
    completeGoogleLogin()
      .then(() => navigate('/', { replace: true }))
      .catch((caught: unknown) => setCallbackError(caught instanceof Error ? caught.message : 'No se ha podido completar el acceso con Google.'))
  }, [completeGoogleLogin, navigate, providerError])

  return <AuthCard eyebrow="Google OAuth" title={error ? 'Enlace interrumpido' : 'Sincronizando identidad'} description={error ?? 'Estamos validando la sesión segura y preparando tu espacio personal.'}><div className="grid gap-5 text-center">{error ? <LockKeyhole className="mx-auto size-14 text-neon-magenta" /> : <ShieldCheck className="mx-auto size-14 animate-pulse text-tertiary" />}<Button className="w-full" variant={error ? 'ghost' : 'cyan'} icon={error ? ArrowRight : ShieldCheck} disabled={!error} onClick={() => navigate('/login')}>{error ? 'Volver al acceso' : 'Verificando con Google…'}</Button></div></AuthCard>
}

export function ErrorPage() {
  return <AuthCard eyebrow="Interferencia" title="No se pudo sincronizar" description="El canal está temporalmente fuera de línea."><div className="grid gap-4 text-center"><LockKeyhole className="mx-auto size-12 text-neon-magenta" /><Button onClick={() => window.location.reload()}>Reintentar conexión</Button></div></AuthCard>
}
