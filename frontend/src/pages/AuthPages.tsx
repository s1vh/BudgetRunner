import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Globe as Chrome, KeyRound, LockKeyhole, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button, Field, Input, SynthCard } from '@/components/ui/primitives'

function AuthCard({ eyebrow, title, description, children, footer }: { eyebrow: string; title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return <SynthCard className="w-full max-w-md p-6 sm:p-8"><p className="font-mono text-[10px] tracking-[0.16em] text-neon-cyan uppercase">{eyebrow}</p><h1 className="mt-2 font-display text-2xl font-black sm:text-3xl">{title}</h1><p className="mt-3 text-sm leading-6 text-text-muted">{description}</p><div className="mt-7">{children}</div>{footer && <div className="mt-6 border-t border-outline-soft/50 pt-5 text-center text-sm text-text-muted">{footer}</div>}</SynthCard>
}

export function LoginPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  function submit(event: FormEvent) { event.preventDefault(); setBusy(true); window.setTimeout(() => navigate('/'), 350) }
  return <AuthCard eyebrow="Acceso seguro" title="Conecta con tu ciclo" description="Entra en la consola financiera. Este prototipo acepta cualquier credencial y utiliza datos internos." footer={<>¿Primera transmisión? <Link to="/registro" className="text-neon-cyan hover:underline">Crear cuenta</Link></>}><form className="grid gap-5" onSubmit={submit}><Field label="Email" htmlFor="login-email" required><Input id="login-email" type="email" defaultValue="mike@budgetrunner.local" autoComplete="email" /></Field><Field label="Contraseña" htmlFor="login-password" required><Input id="login-password" type="password" defaultValue="budgetrunner" autoComplete="current-password" /></Field><div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-text-muted"><input type="checkbox" className="accent-neon-cyan" defaultChecked />Recordarme</label><Link to="/recuperar" className="text-tertiary hover:underline">¿Olvidaste la clave?</Link></div><Button type="submit" className="w-full" icon={ArrowRight} loading={busy}>Entrar al sistema</Button><Button type="button" className="w-full" variant="ghost" icon={Chrome} onClick={() => navigate('/oauth/callback')}>Continuar con Google</Button></form></AuthCard>
}

export function RegisterPage() {
  const navigate = useNavigate()
  return <AuthCard eyebrow="Nueva identidad" title="Únete a la red" description="Se crearán categorías retrofuturistas, progreso de nivel 1 y saldo SynthCoin cero." footer={<>¿Ya tienes identidad? <Link to="/login" className="text-neon-cyan hover:underline">Iniciar sesión</Link></>}><form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); navigate('/') }}><Field label="Nombre visible" htmlFor="register-name" required><Input id="register-name" placeholder="Nómada" autoComplete="name" /></Field><Field label="Email" htmlFor="register-email" required><Input id="register-email" type="email" placeholder="nomada@nexus.local" autoComplete="email" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Moneda" htmlFor="register-currency"><select id="register-currency" className="form-control"><option>EUR</option><option>USD</option></select></Field><Field label="Zona" htmlFor="register-timezone"><select id="register-timezone" className="form-control"><option>Europe/Madrid</option><option>UTC</option></select></Field></div><Field label="Contraseña" htmlFor="register-password" hint="Mínimo 10 caracteres en la futura API." required><Input id="register-password" type="password" autoComplete="new-password" /></Field><Button className="w-full" icon={UserPlus}>Crear identidad</Button></form></AuthCard>
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  return <AuthCard eyebrow="Recuperación" title="Restaurar acceso" description="La respuesta será idéntica exista o no la cuenta, evitando enumeración de usuarios." footer={<Link to="/login" className="text-neon-cyan hover:underline">Volver al acceso</Link>}>{sent ? <div className="rounded-lg border border-success/25 bg-success/5 p-5 text-center"><Mail className="mx-auto mb-3 size-6 text-success" /><strong className="block text-success">Transmisión enviada</strong><p className="mt-2 text-sm text-text-muted">Si la cuenta existe, recibirá un enlace de un solo uso.</p></div> : <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); setSent(true) }}><Field label="Email" htmlFor="forgot-email" required><Input id="forgot-email" type="email" placeholder="nomada@nexus.local" /></Field><Button icon={Mail} className="w-full">Enviar enlace</Button></form>}</AuthCard>
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  return <AuthCard eyebrow="Token verificado" title="Nueva contraseña" description="El token de recuperación se consumirá una única vez."><form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); navigate('/login') }}><Field label="Nueva contraseña" htmlFor="reset-password" required><Input id="reset-password" type="password" autoComplete="new-password" /></Field><Field label="Confirmación" htmlFor="reset-confirm" required><Input id="reset-confirm" type="password" autoComplete="new-password" /></Field><Button className="w-full" icon={KeyRound}>Actualizar acceso</Button></form></AuthCard>
}

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  return <AuthCard eyebrow="Google OAuth" title="Enlace verificado" description="La cuenta mock se ha vinculado sin duplicar la identidad por email verificado."><div className="grid gap-5 text-center"><ShieldCheck className="mx-auto size-14 text-success drop-shadow-[0_0_14px_rgba(99,224,99,.45)]" /><p className="text-sm text-text-muted">Estado y firma validados. El backend intercambiará el código por una sesión rotatoria.</p><Button className="w-full" icon={ArrowRight} onClick={() => navigate('/')}>Continuar</Button></div></AuthCard>
}

export function ErrorPage() {
  return <AuthCard eyebrow="Interferencia" title="No se pudo sincronizar" description="El canal está temporalmente fuera de línea."><div className="grid gap-4 text-center"><LockKeyhole className="mx-auto size-12 text-neon-magenta" /><Button onClick={() => window.location.reload()}>Reintentar conexión</Button></div></AuthCard>
}
