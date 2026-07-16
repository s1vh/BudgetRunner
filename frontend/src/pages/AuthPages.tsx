import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Globe as Chrome, KeyRound, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/app/AuthContext'
import { Button, Field, Input, SynthCard } from '@/components/ui/primitives'

function AuthCard({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return <SynthCard className="w-full max-w-md p-6 sm:p-8"><p className="font-mono text-[10px] tracking-[0.16em] text-neon-cyan uppercase">{eyebrow}</p><h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 text-sm leading-6 text-text-muted">{description}</p><div className="mt-7">{children}</div>{footer && <div className="mt-6 border-t border-outline-soft/50 pt-5 text-center text-sm text-text-muted">{footer}</div>}</SynthCard>
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
      <Button type="button" className="w-full" variant="ghost" icon={Chrome} disabled title="Google OAuth se conectará en la siguiente fase">Google OAuth · próxima fase</Button>
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
  return <AuthCard eyebrow="Google OAuth" title="Canal pendiente" description="La vinculación con Google está reservada para la siguiente fase."><div className="grid gap-5 text-center"><ShieldCheck className="mx-auto size-14 text-tertiary" /><Button className="w-full" icon={ArrowRight} onClick={() => navigate('/login')}>Volver al acceso</Button></div></AuthCard>
}

export function ErrorPage() {
  return <AuthCard eyebrow="Interferencia" title="No se pudo sincronizar" description="El canal está temporalmente fuera de línea."><div className="grid gap-4 text-center"><LockKeyhole className="mx-auto size-12 text-neon-magenta" /><Button onClick={() => window.location.reload()}>Reintentar conexión</Button></div></AuthCard>
}
