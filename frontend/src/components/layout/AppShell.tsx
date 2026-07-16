import {
  CircleDollarSign,
  Gamepad2,
  Gauge,
  LogOut,
  Radar,
  Settings,
  UserRound,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAppData } from '@/app/AppDataContext'
import { AmbientBackground } from './AmbientBackground'
import { cn, Progress } from '@/components/ui/primitives'

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: Gauge, end: true },
  { to: '/gastos', label: 'Gastos', icon: WalletCards },
  { to: '/presupuestos', label: 'Presupuestos', icon: Radar },
  { to: '/gamificacion', label: 'Gamificación', icon: Gamepad2 },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
]

function DesktopNav() {
  const { data } = useAppData()
  const navigate = useNavigate()
  const profile = data?.profile
  const initials = profile?.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('') ?? 'BR'
  const levelProgress = profile ? profile.progress.totalFlux - profile.progress.currentLevelFlux : 0
  const levelRange = profile ? profile.progress.nextLevelFlux - profile.progress.currentLevelFlux : 1

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-outline-soft/70 bg-space-black/88 px-3 py-4 shadow-[5px_0_30px_rgba(139,0,255,0.12)] backdrop-blur-xl md:flex">
      <NavLink to="/" className="flex items-center gap-3 border-b border-outline-soft/60 px-2 pb-5">
        <span className="grid size-11 place-items-center rounded-full border-2 border-neon-cyan text-neon-cyan shadow-[0_0_14px_rgba(0,255,255,.35)]"><CircleDollarSign className="size-6" /></span>
        <span><strong className="block font-display text-sm font-black tracking-[0.08em] text-text-glow uppercase">Vibe to Live</strong><small className="font-mono text-[10px] text-tertiary">Budget Runner</small></span>
      </NavLink>
      <nav className="mt-5 flex flex-1 flex-col gap-1.5" aria-label="Navegación principal">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('group flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] px-3 font-mono text-xs font-bold tracking-[0.05em] uppercase transition', isActive ? 'border-neon-cyan bg-neon-cyan/8 text-neon-cyan' : 'border-transparent text-text-muted hover:border-tertiary/50 hover:bg-white/4 hover:text-text-glow')}>
            <Icon className="size-[18px] transition group-hover:drop-shadow-[0_0_7px_currentColor]" /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="grid gap-3 border-t border-outline-soft/60 pt-4">
        <button type="button" onClick={() => navigate('/perfil')} className="flex items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/4">
          <span className="grid size-10 place-items-center rounded-full border border-neon-magenta/55 bg-neon-magenta/10 font-display text-xs font-bold text-neon-magenta">{initials}</span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{profile?.displayName ?? 'Nómada'}</strong><small className="font-mono text-[10px] text-text-muted">Nivel {profile?.progress.level ?? '--'} · {profile?.progress.synthcoins ?? 0} SC</small></span>
        </button>
        <Progress value={levelProgress} max={levelRange} tone="purple" />
        <button type="button" onClick={() => navigate('/login')} className="flex min-h-11 items-center gap-3 rounded-lg px-3 font-mono text-xs text-text-muted transition hover:bg-neon-magenta/6 hover:text-neon-magenta"><LogOut className="size-4" />Cerrar sesión</button>
      </div>
    </aside>
  )
}

function MobileNav() {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-4 rounded-xl border border-outline-soft/70 bg-space-black/92 p-1.5 shadow-[0_0_30px_rgba(0,0,0,.55)] backdrop-blur-xl md:hidden" aria-label="Navegación móvil">
      {navItems.slice(0, 4).map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('grid min-h-12 place-items-center rounded-lg font-mono text-[9px] font-bold uppercase transition', isActive ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-text-muted')}><Icon className="size-[18px]" /><span>{label === 'Gamificación' ? 'Deck' : label}</span></NavLink>)}
    </nav>
  )
}

export function AppShell() {
  const { data } = useAppData()
  const preferences = data?.profile.preferences
  return (
    <div className={cn('min-h-screen', preferences?.reducedMotion && 'reduce-motion', preferences?.compactMode && 'compact-mode')}>
      <AmbientBackground />
      <DesktopNav />
      <MobileNav />
      <main className="min-h-screen pb-24 md:ml-64 md:pb-0">
        <div className="page-content mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">
          <Outlet />
          <footer className="mt-10 flex flex-col gap-2 border-t border-outline-soft/50 py-6 font-mono text-[10px] tracking-wide text-text-muted sm:flex-row sm:items-center sm:justify-between">
            <span>Budget Runner © 2026 <a href="https://www.linkedin.com/in/mikefieldins/" target="_blank" rel="noreferrer noopener" className="text-neon-cyan hover:underline">Mike Fieldins</a></span>
            <NavLink to="/licencia" className="hover:text-neon-cyan">MIT License</NavLink>
          </footer>
        </div>
      </main>
      <div className="fixed right-4 top-4 z-30 hidden items-center gap-2 rounded-full border border-success/20 bg-void/65 px-3 py-1.5 font-mono text-[9px] tracking-widest text-success uppercase backdrop-blur md:flex"><span className="status-dot" />Mock online</div>
      <Zap className="fixed right-5 bottom-24 -z-1 size-28 text-neon-magenta opacity-[0.025] md:bottom-8" aria-hidden="true" />
    </div>
  )
}
