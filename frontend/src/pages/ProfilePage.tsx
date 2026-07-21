import { CalendarCheck, Coins, Flame, Gauge, KeyRound, Link2, ShieldCheck, Sparkles, UserRound, Zap } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAppData } from '@/app/AppDataContext'
import { Badge, Button, PageSkeleton, Progress, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import { localeOptions, resolveLocale } from '@/i18n/locales'
import { formatDate } from '@/utils/format'

export function ProfilePage() {
  const { t, td } = useI18n()
  const navigate = useNavigate()
  const { data, loading } = useAppData()

  if (loading || !data) return <PageSkeleton />
  const { profile } = data
  const initials = profile.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')
  const progressValue = profile.progress.totalFlux - profile.progress.currentLevelFlux
  const progressMax = profile.progress.nextLevelFlux - profile.progress.currentLevelFlux
  const languageLabel = localeOptions.find((option) => option.value === resolveLocale(profile.locale))?.label ?? profile.locale

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow={t('profile.eyebrow')} title={t('profile.title')} description={t('profile.description')} icon={UserRound} tourId="profile-header" />
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SynthCard className="p-6 text-center" tone="cyan" data-tour="profile-identity">
          <div className="mx-auto grid size-24 place-items-center rounded-full border-2 border-neon-cyan bg-neon-cyan/7 font-display text-2xl font-black text-neon-cyan shadow-[0_0_28px_rgba(0,255,255,.22)]">{initials}</div>
          <h2 className="mt-5 font-display text-xl font-bold">{profile.displayName}</h2>
          <p className="mt-1 font-mono text-xs text-text-muted">{profile.email}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Badge tone="cyan">{t('common.level', { level: profile.progress.level })}</Badge>
            <Badge tone={profile.googleConnected ? 'success' : 'muted'}><Link2 className="size-3" />{profile.googleConnected ? t('profile.googleConnected') : t('profile.googleDisconnected')}</Badge>
          </div>
          <div className="mt-6 text-left"><Progress value={progressValue} max={progressMax} tone="purple" label={t('profile.nextLevel')} /></div>
          <Button className="mt-6 w-full" variant="ghost" icon={KeyRound}>{t('profile.accountSecurity')}</Button>
        </SynthCard>
        <div className="grid gap-4 sm:grid-cols-2" data-tour="profile-progress">
          <SynthCard className="p-5" tone="purple"><Sparkles className="size-5 text-tertiary" /><p className="mt-4 font-mono text-[10px] text-text-muted uppercase">{t('profile.totalFlux')}</p><strong className="font-display text-3xl text-tertiary tabular">{profile.progress.totalFlux}</strong><div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono text-[10px]"><span className="rounded border border-white/8 p-2">{profile.progress.baseFlux}<small className="block text-text-muted">{t('game.baseFlux')}</small></span><span className="rounded border border-white/8 p-2">{profile.progress.activePower}<small className="block text-text-muted">{t('game.power')}</small></span><span className="rounded border border-white/8 p-2">+{profile.progress.familyBonusPower}<small className="block text-text-muted">{t('game.bonus')}</small></span></div></SynthCard>
          <SynthCard className="p-5" tone="magenta"><Coins className="size-5 text-sunset" /><p className="mt-4 font-mono text-[10px] text-text-muted uppercase">{t('profile.wallet')}</p><strong className="font-display text-3xl text-sunset tabular">{profile.progress.synthcoins}</strong><p className="mt-4 text-xs text-text-muted">{t('profile.walletDetail')}</p></SynthCard>
          <SynthCard className="p-5"><Flame className="size-5 text-neon-magenta" /><p className="mt-4 font-mono text-[10px] text-text-muted uppercase">{t('profile.weeklyStreak')}</p><strong className="font-display text-3xl text-neon-magenta">{profile.progress.weeklyStreak}</strong><p className="mt-2 text-xs text-text-muted">{t('profile.consecutiveCycles')}</p></SynthCard>
          <SynthCard className="p-5"><CalendarCheck className="size-5 text-neon-cyan" /><p className="mt-4 font-mono text-[10px] text-text-muted uppercase">{t('profile.monthlyStreak')}</p><strong className="font-display text-3xl text-neon-cyan">{profile.progress.monthlyStreak}</strong><p className="mt-2 text-xs text-text-muted">{t('profile.monthsControlled')}</p></SynthCard>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <SynthCard className="overflow-hidden" data-tour="profile-history">
          <div className="flex items-center gap-2 border-b border-outline-soft/60 p-5"><Gauge className="size-4 text-tertiary" /><h2 className="font-display text-sm font-bold uppercase">{t('profile.levelHistory')}</h2></div>
          <ol className="divide-y divide-outline-soft/45">{profile.levelHistory.map((entry) => <li key={`${entry.level}-${entry.reachedAt}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-5"><span className="grid size-10 place-items-center rounded-lg border border-tertiary/25 bg-tertiary/7 font-display text-sm text-tertiary">{entry.level}</span><span><strong className="block text-sm">{td(entry.reason)}</strong><small className="text-text-muted">{formatDate(entry.reachedAt)}</small></span><span className="font-mono text-xs text-text-muted">{entry.flux} Flux</span></li>)}</ol>
        </SynthCard>
        <SynthCard className="p-5" data-tour="profile-regional">
          <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-success" /><h2 className="font-display text-sm font-bold uppercase">{t('profile.regionalContext')}</h2></div>
          <dl className="mt-5 grid gap-4 text-sm">
            <div className="flex justify-between gap-3 border-b border-outline-soft/45 pb-3"><dt className="text-text-muted">{t('profile.language')}</dt><dd className="text-right font-mono text-xs">{languageLabel}</dd></div>
            <div className="flex justify-between gap-3 border-b border-outline-soft/45 pb-3"><dt className="text-text-muted">{t('profile.currency')}</dt><dd className="font-mono">{profile.primaryCurrency}</dd></div>
            <div className="flex justify-between gap-3 border-b border-outline-soft/45 pb-3"><dt className="text-text-muted">{t('profile.timezone')}</dt><dd className="font-mono text-xs">{profile.timezone}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-text-muted">{t('profile.weekStart')}</dt><dd className="font-mono">{profile.weekStartsOn === 7 ? t('profile.sunday') : t('profile.monday')}</dd></div>
          </dl>
          <Button className="mt-6 w-full" variant="ghost" icon={Zap} onClick={() => navigate('/ajustes')}>{t('profile.editSettings')}</Button>
        </SynthCard>
      </div>
    </div>
  )
}
