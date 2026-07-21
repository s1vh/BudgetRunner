import { CircleDollarSign } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { AmbientBackground } from './AmbientBackground'
import { useI18n } from '@/i18n/I18nContext'

export function PublicShell() {
  const { t } = useI18n()
  return (
    <div className="relative min-h-screen overflow-hidden">
      <AmbientBackground />
      <header className="relative z-10 flex items-center justify-between p-5 sm:p-8">
        <Link to="/login" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full border border-neon-cyan text-neon-cyan"><CircleDollarSign className="size-5" /></span><span className="font-display text-sm font-black tracking-wider uppercase">Budget Runner</span></Link>
        <span className="hidden font-mono text-[10px] tracking-[0.16em] text-text-muted uppercase sm:block">{t('app.tagline')}</span>
      </header>
      <main className="relative z-10 grid min-h-[calc(100vh-148px)] place-items-center px-4 py-8"><Outlet /></main>
      <footer className="relative z-10 p-5 text-center font-mono text-[10px] text-text-muted">Budget Runner © 2026 <a href="https://www.linkedin.com/in/mikefieldins/" target="_blank" rel="noreferrer noopener" className="text-neon-cyan transition hover:underline">Mike Fieldins</a> · MIT License</footer>
    </div>
  )
}
