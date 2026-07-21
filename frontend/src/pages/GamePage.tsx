import { useMemo, useState } from 'react'
import { BatteryCharging, Coins, Cpu, Gamepad2, History, LockKeyhole, PackageOpen, Shield, ShoppingBag, Sparkles, Wrench, Zap } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { CyberdeckDiagram, familyColors } from '@/components/game/CyberdeckDiagram'
import { ModuleCard } from '@/components/game/ModuleCard'
import { Badge, Button, Modal, PageSkeleton, Progress, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'
import type { CyberModule, StoreOffer } from '@/types/domain'
import { formatDate, formatNumber } from '@/utils/format'

type GameTab = 'summary' | 'deck' | 'store' | 'repairs' | 'history'
const tabs: Array<{ id: GameTab; labelKey: TranslationKey; icon: typeof Gamepad2 }> = [
  { id: 'summary', labelKey: 'game.tab.summary', icon: Gamepad2 },
  { id: 'deck', labelKey: 'game.tab.deck', icon: Cpu },
  { id: 'store', labelKey: 'game.tab.store', icon: ShoppingBag },
  { id: 'repairs', labelKey: 'game.tab.repairs', icon: Wrench },
  { id: 'history', labelKey: 'game.tab.history', icon: History },
]

export function GamePage() {
  const { t, td } = useI18n()
  const { data, loading, purchaseModule, repairModule } = useAppData()
  const [tab, setTab] = useState<GameTab>('summary')
  const [selectedModule, setSelectedModule] = useState<CyberModule | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<StoreOffer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const repairable = useMemo(() => data?.game.modules.filter((module) => module.energy > 0 && module.energy < 100) ?? [], [data])
  if (loading || !data) return <PageSkeleton />
  const { game } = data
  const progressValue = game.progress.totalFlux - game.progress.currentLevelFlux
  const progressMax = game.progress.nextLevelFlux - game.progress.currentLevelFlux
  const offerCount = game.offers.length

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow={t('game.eyebrow')} title={t('game.title')} description={t('game.description')} icon={Gamepad2} tourId="game" />
      {notice && <button type="button" onClick={() => setNotice(null)} className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3 text-left text-sm text-neon-cyan">{notice}</button>}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map(({ id, labelKey, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 font-mono text-[10px] font-bold uppercase transition ${tab === id ? 'border-neon-cyan/45 bg-neon-cyan/8 text-neon-cyan' : 'border-white/10 text-text-muted hover:text-text-glow'}`}><Icon className="size-4" />{t(labelKey)}</button>)}
      </div>

      {tab === 'summary' && <section className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: t('common.level', { level: '' }).trim(), value: game.progress.level, icon: Sparkles, color: 'text-neon-cyan', helpKey: 'help.game.level' as const },
            { label: 'SynthCoins', value: formatNumber(game.progress.synthcoins), icon: Coins, color: 'text-sunset', helpKey: 'help.game.synthcoins' as const },
            { label: t('game.activePower'), value: game.progress.activePower, icon: Zap, color: 'text-neon-magenta', helpKey: 'help.game.power' as const },
            { label: t('game.familyBonus'), value: `+${game.progress.familyBonusPower}`, icon: Shield, color: 'text-tertiary', helpKey: 'help.game.familyBonus' as const },
          ].map(({ label, value, icon: Icon, color, helpKey }) => <SynthCard key={label} className="p-5 pr-14" helpKey={helpKey}><div className="flex items-center justify-between"><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{label}</p><Icon className={`size-4 ${color}`} /></div><strong className={`mt-3 block font-display text-3xl tabular ${color}`}>{value}</strong></SynthCard>)}
        </div>
        <SynthCard className="p-5 pr-14 sm:p-6 sm:pr-16" tone="purple" helpKey="help.game.totalFlux">
          <div className="mb-3 flex items-end justify-between"><div><p className="font-mono text-[10px] text-text-muted uppercase">{t('profile.totalFlux')}</p><strong className="font-display text-2xl text-tertiary">{game.progress.totalFlux}</strong></div><span className="font-mono text-xs text-text-muted">{t('game.nextLevel', { level: game.progress.level + 1, flux: game.progress.nextLevelFlux })}</span></div>
          <Progress value={progressValue} max={progressMax} tone="purple" label={t('game.fluxProgress', { value: progressValue, max: progressMax })} />
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">{t('game.baseFlux')}</span><strong className="block text-lg">{game.progress.baseFlux}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">{t('game.power')}</span><strong className="block text-lg">+{game.progress.activePower}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">{t('game.bonus')}</span><strong className="block text-lg">+{game.progress.familyBonusPower}</strong></div></div>
        </SynthCard>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{game.familyBonuses.map((bonus) => <SynthCard key={bonus.family} className="p-4 pr-14" helpKey="help.game.family"><div className="mb-3 flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: familyColors[bonus.family], boxShadow: `0 0 8px ${familyColors[bonus.family]}` }} /><strong className="font-display text-xs uppercase" style={{ color: familyColors[bonus.family] }}>{bonus.family.replace('_', ' ')}</strong></div><p className="font-mono text-[10px] text-text-muted">{t('game.modulesCount', { count: bonus.count, power: bonus.power })}</p><p className="mt-2 text-sm">{t('game.activeBonus', { bonus: `+${bonus.bonus}` })}</p></SynthCard>)}</div>
      </section>}

      {tab === 'deck' && <section className="grid gap-4"><SynthCard className="p-3 pr-14 sm:p-5 sm:pr-16" helpKey="help.game.cyberdeck"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-sm font-bold uppercase">{t('game.diagramTitle')}</h2><p className="mt-1 text-xs text-text-muted">{t('game.diagramHint')}</p></div><Badge tone="cyan">{game.modules.filter((module) => module.state === 'equipped').length}/10 {t('common.online')}</Badge></div><CyberdeckDiagram modules={game.modules} selectedId={selectedModule?.instanceId} onSelect={setSelectedModule} /></SynthCard></section>}

      {tab === 'store' && <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">{offerCount > 0 ? t(offerCount === 1 ? 'game.rotation.one' : 'game.rotation.other', { count: offerCount, date: formatDate(game.offers[0]!.expiresAt) }) : t('game.rotationEmpty')}</p><Badge tone={offerCount > 0 ? 'success' : 'purple'}><PackageOpen className="size-3" />{offerCount > 0 ? t('game.purchasesAvailable') : t('game.noOffers')}</Badge></div>
        {offerCount > 0 ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{game.offers.map((offer) => <ModuleCard key={offer.id} module={offer.module} helpKey="help.game.storeModule" footer={<div className="flex items-center justify-between gap-3"><div><span className="block font-mono text-[9px] text-text-muted">{t('game.netCost')}</span><strong className="font-display text-lg text-sunset">{offer.netCost} SC</strong></div><Button className="px-3 text-[10px]" variant={offer.minLevel > game.progress.level ? 'ghost' : 'cyan'} disabled={offer.minLevel > game.progress.level} onClick={(event) => { event.stopPropagation(); setSelectedOffer(offer) }}>{offer.minLevel > game.progress.level ? t('common.level', { level: offer.minLevel }) : t('game.buy')}</Button></div>} />)}</div> : <SynthCard className="p-8 pr-14 text-center" helpKey="help.game.storeEmpty"><PackageOpen className="mx-auto mb-3 size-8 text-tertiary" /><h3 className="font-display text-sm uppercase">{t('game.rotationComplete')}</h3><p className="mt-2 text-sm text-text-muted">{t('game.rotationCompleteDesc')}</p></SynthCard>}
      </section>}

      {tab === 'repairs' && <section><div className="mb-4 rounded-lg border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-text-muted"><BatteryCharging className="mr-2 inline size-4 text-tertiary" />{t('game.repairsInfo')}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{repairable.map((module) => { const cost = module.repairCost ?? 0; return <ModuleCard key={module.instanceId} module={module} helpKey="help.game.repairModule" footer={<div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-sunset">{cost} SC</span><Button variant="purple" icon={Wrench} className="px-3 text-[10px]" loading={actionBusy === module.instanceId} onClick={async (event) => { event.stopPropagation(); setActionBusy(module.instanceId); try { await repairModule(module.instanceId); setNotice(t('game.repairConfirmed', { name: module.name })) } catch (caught) { setNotice(caught instanceof Error ? caught.message : t('game.repairFailed')) } finally { setActionBusy(null) } }}>{t('game.repair')}</Button></div>} />})}</div></section>}

      {tab === 'history' && <SynthCard className="overflow-hidden" helpKey="help.game.history"><ul className="divide-y divide-outline-soft/50">{game.history.map((event) => <li key={event.id} className="grid gap-3 p-4 first:pr-14 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5 sm:first:pr-16"><span className="icon-chip text-tertiary"><History className="size-4" /></span><span><strong className="block text-sm">{td(event.title)}</strong><small className="text-text-muted">{td(event.detail)}</small></span><span className="font-mono text-xs text-text-muted">{formatDate(event.occurredAt)}{event.amount !== undefined && <strong className={`ml-3 ${event.amount > 0 ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{event.amount > 0 ? '+' : ''}{event.amount} SC</strong>}</span></li>)}</ul></SynthCard>}

      <Modal open={Boolean(selectedModule)} onClose={() => setSelectedModule(null)} title={selectedModule?.name ?? t('game.module')} description={selectedModule ? td({ key: selectedModule.descriptionKey ?? '', fallback: selectedModule.description }) : undefined}>
        {selectedModule && <div className="grid gap-5"><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg border border-white/8 p-3"><Zap className="mx-auto mb-2 size-4 text-neon-cyan" /><strong className="font-display text-xl">{selectedModule.power}</strong><span className="block font-mono text-[9px] text-text-muted">{t('game.power')}</span></div><div className="rounded-lg border border-white/8 p-3"><Shield className="mx-auto mb-2 size-4 text-tertiary" /><strong className="font-display text-xl">{selectedModule.shield}</strong><span className="block font-mono text-[9px] text-text-muted">{t('game.shield')}</span></div><div className="rounded-lg border border-white/8 p-3"><BatteryCharging className="mx-auto mb-2 size-4 text-sunset" /><strong className="font-display text-xl">{selectedModule.energy}%</strong><span className="block font-mono text-[9px] text-text-muted">{t('game.energy')}</span></div></div><Progress value={selectedModule.energy} tone={selectedModule.energy <= 25 ? 'magenta' : selectedModule.energy < 50 ? 'warning' : 'cyan'} label={t('game.integrity')} /><Button variant="ghost" onClick={() => setSelectedModule(null)}>{t('game.closeTelemetry')}</Button></div>}
      </Modal>

      <Modal open={Boolean(selectedOffer)} onClose={() => setSelectedOffer(null)} title={t('game.acquire', { name: selectedOffer?.module.name ?? '' })} description={t('game.acquireDesc')}>
        {selectedOffer && <div className="grid gap-5"><div className="grid grid-cols-3 gap-3 font-mono text-center text-xs"><div className="rounded-lg border border-white/8 p-3"><span className="text-text-muted">{t('game.price')}</span><strong className="mt-2 block text-lg">{selectedOffer.module.priceCoins}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="text-text-muted">{t('game.tradeIn')}</span><strong className="mt-2 block text-lg text-tertiary">−{selectedOffer.tradeInValue}</strong></div><div className="rounded-lg border border-sunset/20 p-3"><span className="text-text-muted">{t('game.net')}</span><strong className="mt-2 block text-lg text-sunset">{selectedOffer.netCost}</strong></div></div><div className="flex items-center gap-2 rounded-lg border border-neon-magenta/20 bg-neon-magenta/5 p-3 text-xs text-text-muted"><LockKeyhole className="size-4 shrink-0 text-neon-magenta" />{t('game.serverRecalculation')}</div><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setSelectedOffer(null)}>{t('common.cancel')}</Button><Button icon={Coins} loading={actionBusy === selectedOffer.id} onClick={async () => { setActionBusy(selectedOffer.id); try { await purchaseModule(selectedOffer.id); setNotice(t('game.purchaseConfirmed', { name: selectedOffer.module.name })); setSelectedOffer(null) } catch (caught) { setNotice(caught instanceof Error ? caught.message : t('game.purchaseFailed')) } finally { setActionBusy(null) } }}>{t('game.confirmPurchase')}</Button></div></div>}
      </Modal>
    </div>
  )
}
