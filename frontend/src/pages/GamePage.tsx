import { lazy, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BatteryCharging, Coins, Gamepad2, History, Shield, ShoppingBag, Sparkles, Wrench, Zap } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { CyberdeckDiagram, familyColors } from '@/components/game/CyberdeckDiagram'
import { ModuleCard } from '@/components/game/ModuleCard'
import { Badge, Button, Modal, Progress, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'
import type { CyberModule } from '@/types/domain'
import { formatDate, formatNumber } from '@/utils/format'
import { useHelpCenter } from '@/components/help/HelpCenterContext'
import { AsyncBoundary, StorePanelLoader } from '@/components/routing/AsyncBoundary'
import { DataQueryState } from '@/components/routing/DataQueryState'
import { storeOffersQueryOptions, useCyberdeckQuery, useFamilyBonusesQuery, useGameHistoryQuery, useGameSummaryQuery } from '@/app/dataQueries'

const loadGameStorePanel = () => import('@/components/game/GameStorePanel')
const GameStorePanel = lazy(() => loadGameStorePanel().then((module) => ({ default: module.GameStorePanel })))
function preloadGameStorePanel() {
  void loadGameStorePanel()
}
function canRepair(module: CyberModule) { return module.state === 'equipped' && module.energy > 0 && module.energy < 100 }

type GameTab = 'summary' | 'store' | 'repairs' | 'history'
const tabs: Array<{ id: GameTab; labelKey: TranslationKey; icon: typeof Gamepad2 }> = [
  { id: 'summary', labelKey: 'game.tab.summary', icon: Gamepad2 },
  { id: 'store', labelKey: 'game.tab.store', icon: ShoppingBag },
  { id: 'repairs', labelKey: 'game.tab.repairs', icon: Wrench },
  { id: 'history', labelKey: 'game.tab.history', icon: History },
]
const tourTabByTarget: Record<string, GameTab> = {
  'game-tabs': 'summary', 'game-summary': 'summary', 'game-flux': 'summary', 'game-families': 'summary', 'game-deck': 'summary',
  'game-store': 'store', 'game-repairs': 'repairs', 'game-history': 'history',
}

export function GamePage() {
  const { t, td } = useI18n()
  const { activeTourTarget } = useHelpCenter()
  const { repairModule } = useAppData()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<GameTab>('summary')
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const visibleTab = (activeTourTarget ? tourTabByTarget[activeTourTarget] : undefined) ?? tab
  const summaryQuery = useGameSummaryQuery(visibleTab === 'summary' || visibleTab === 'store')
  const familyBonusesQuery = useFamilyBonusesQuery(visibleTab === 'summary')
  const cyberdeckQuery = useCyberdeckQuery(visibleTab === 'summary' || visibleTab === 'repairs')
  const historyQuery = useGameHistoryQuery(visibleTab === 'history')
  const gameProgress = summaryQuery.data
  const familyBonuses = familyBonusesQuery.data
  const cyberdeck = cyberdeckQuery.data
  const gameHistory = historyQuery.data
  const selectedModule = useMemo(() => cyberdeck?.find((module) => module.instanceId === selectedModuleId) ?? null, [cyberdeck, selectedModuleId])
  const repairable = useMemo(() => cyberdeck?.filter(canRepair) ?? [], [cyberdeck])
  const progressValue = gameProgress ? gameProgress.totalFlux - gameProgress.currentLevelFlux : 0
  const progressMax = gameProgress ? gameProgress.nextLevelFlux - gameProgress.currentLevelFlux : 1
  const preloadStore = () => { preloadGameStorePanel(); void queryClient.prefetchQuery(storeOffersQueryOptions) }
  const runRepair = async (module: CyberModule) => {
    if (!canRepair(module)) return
    setActionBusy(module.instanceId)
    try {
      await repairModule(module.instanceId)
      setNotice(t('game.repairConfirmed', { name: module.name }))
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : t('game.repairFailed'))
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow={t('game.eyebrow')} title={t('game.title')} description={t('game.description')} icon={Gamepad2} tourId="game-header" />
      {notice && <button type="button" onClick={() => setNotice(null)} className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3 text-left text-sm text-neon-cyan">{notice}</button>}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" data-tour="game-tabs">
        {tabs.map(({ id, labelKey, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={visibleTab === id} onMouseEnter={id === 'store' ? preloadStore : undefined} onFocus={id === 'store' ? preloadStore : undefined} onClick={() => { if (id === 'store') preloadStore(); setTab(id) }} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 font-mono text-[10px] font-bold uppercase transition ${visibleTab === id ? 'border-neon-cyan/45 bg-neon-cyan/8 text-neon-cyan' : 'border-white/10 text-text-muted hover:text-text-glow'}`}><Icon className="size-4" />{t(labelKey)}</button>)}
      </div>

      {visibleTab === 'summary' && <>
        {!gameProgress || !familyBonuses || summaryQuery.isPending || familyBonusesQuery.isPending || summaryQuery.isError || familyBonusesQuery.isError
          ? <DataQueryState pending={summaryQuery.isPending || familyBonusesQuery.isPending} error={summaryQuery.isError || familyBonusesQuery.isError} retry={() => { void summaryQuery.refetch(); void familyBonusesQuery.refetch() }}><span /></DataQueryState>
          : <section className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="game-summary">
              {[
                { label: t('common.level', { level: '' }).trim(), value: gameProgress.level, icon: Sparkles, color: 'text-neon-cyan', helpKey: 'help.game.level' as const },
                { label: 'SynthCoins', value: formatNumber(gameProgress.synthcoins), icon: Coins, color: 'text-sunset', helpKey: 'help.game.synthcoins' as const },
                { label: t('game.activePower'), value: gameProgress.activePower, icon: Zap, color: 'text-neon-magenta', helpKey: 'help.game.power' as const },
                { label: t('game.familyBonus'), value: `+${gameProgress.familyBonusPower}`, icon: Shield, color: 'text-tertiary', helpKey: 'help.game.familyBonus' as const },
              ].map(({ label, value, icon: Icon, color, helpKey }) => <SynthCard key={label} className="p-5 pr-14" helpKey={helpKey}><div className="flex items-center justify-between"><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{label}</p><Icon className={`size-4 ${color}`} /></div><strong className={`mt-3 block font-display text-3xl tabular ${color}`}>{value}</strong></SynthCard>)}
            </div>
            <SynthCard className="p-5 pr-14 sm:p-6 sm:pr-16" tone="purple" helpKey="help.game.totalFlux" data-tour="game-flux">
              <div className="mb-3 flex items-end justify-between"><div><p className="font-mono text-[10px] text-text-muted uppercase">{t('profile.totalFlux')}</p><strong className="font-display text-2xl text-tertiary">{gameProgress.totalFlux}</strong></div><span className="font-mono text-xs text-text-muted">{t('game.nextLevel', { level: gameProgress.level + 1, flux: gameProgress.nextLevelFlux })}</span></div>
              <Progress value={progressValue} max={progressMax} tone="purple" label={t('game.fluxProgress', { value: progressValue, max: progressMax })} />
              <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">{t('game.baseFlux')}</span><strong className="block text-lg">{gameProgress.baseFlux}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">{t('game.power')}</span><strong className="block text-lg">+{gameProgress.activePower}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">{t('game.bonus')}</span><strong className="block text-lg">+{gameProgress.familyBonusPower}</strong></div></div>
            </SynthCard>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="game-families">{familyBonuses.map((bonus) => <SynthCard key={bonus.family} className="p-4 pr-14" helpKey="help.game.family"><div className="mb-3 flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: familyColors[bonus.family], boxShadow: `0 0 8px ${familyColors[bonus.family]}` }} /><strong className="font-display text-xs uppercase" style={{ color: familyColors[bonus.family] }}>{bonus.family.replace('_', ' ')}</strong></div><p className="font-mono text-[10px] text-text-muted">{t('game.modulesCount', { count: bonus.count, power: bonus.power })}</p><p className="mt-2 text-sm">{t('game.activeBonus', { bonus: `+${bonus.bonus}` })}</p></SynthCard>)}</div>
          </section>}

        {!cyberdeck || cyberdeckQuery.isPending || cyberdeckQuery.isError
          ? <DataQueryState pending={cyberdeckQuery.isPending} error={cyberdeckQuery.isError} retry={() => void cyberdeckQuery.refetch()}><span /></DataQueryState>
          : <section className="grid gap-4" data-tour="game-deck"><SynthCard className="p-3 pr-14 sm:p-5 sm:pr-16" helpKey="help.game.cyberdeck"><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="font-display text-sm font-bold uppercase">{t('game.diagramTitle')}</h2><p className="mt-1 text-xs text-text-muted">{t('game.diagramHint')}</p></div><Badge tone="cyan">{cyberdeck.filter((module) => module.state === 'equipped').length}/10 {t('common.online')}</Badge></div><CyberdeckDiagram modules={cyberdeck} selectedId={selectedModuleId ?? undefined} onSelect={(module) => setSelectedModuleId(module.instanceId)} /></SynthCard></section>}
      </>}

      {visibleTab === 'store' && (!gameProgress || summaryQuery.isPending || summaryQuery.isError
        ? <DataQueryState mode="panel" pending={summaryQuery.isPending} error={summaryQuery.isError} retry={() => void summaryQuery.refetch()} labelKey="loading.store"><span /></DataQueryState>
        : <AsyncBoundary mode="panel" fallback={<StorePanelLoader />}><GameStorePanel progress={gameProgress} onNotice={setNotice} /></AsyncBoundary>)}

      {visibleTab === 'repairs' && (!cyberdeck || cyberdeckQuery.isPending || cyberdeckQuery.isError
        ? <DataQueryState pending={cyberdeckQuery.isPending} error={cyberdeckQuery.isError} retry={() => void cyberdeckQuery.refetch()}><span /></DataQueryState>
        : <section data-tour="game-repairs"><div className="mb-4 rounded-lg border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-text-muted"><BatteryCharging className="mr-2 inline size-4 text-tertiary" />{t('game.repairsInfo')}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{repairable.map((module) => { const cost = module.repairCost ?? 0; return <ModuleCard key={module.instanceId} module={module} helpKey="help.game.repairModule" footer={<div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-sunset">{cost} SC</span><Button variant="purple" icon={Wrench} className="px-3 text-[10px]" loading={actionBusy === module.instanceId} onClick={(event) => { event.stopPropagation(); void runRepair(module) }}>{t('game.repair')}</Button></div>} /> })}</div></section>)}

      {visibleTab === 'history' && (!gameHistory || historyQuery.isPending || historyQuery.isError
        ? <DataQueryState pending={historyQuery.isPending} error={historyQuery.isError} retry={() => void historyQuery.refetch()}><span /></DataQueryState>
        : <SynthCard className="overflow-hidden" helpKey="help.game.history" data-tour="game-history"><ul className="divide-y divide-outline-soft/50">{gameHistory.map((event) => <li key={event.id} className="grid gap-3 p-4 first:pr-14 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5 sm:first:pr-16"><span className="icon-chip text-tertiary"><History className="size-4" /></span><span><strong className="block text-sm">{td(event.title)}</strong><small className="text-text-muted">{td(event.detail)}</small></span><span className="font-mono text-xs text-text-muted">{formatDate(event.occurredAt)}{event.amount !== undefined && <strong className={`ml-3 ${event.amount > 0 ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{event.amount > 0 ? '+' : ''}{event.amount} SC</strong>}</span></li>)}</ul></SynthCard>)}

      <Modal open={Boolean(selectedModule)} onClose={() => setSelectedModuleId(null)} title={selectedModule?.name ?? t('game.module')} description={selectedModule ? td({ key: selectedModule.descriptionKey ?? '', fallback: selectedModule.description }) : undefined}>
        {selectedModule && <div className="grid gap-5">
          <div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg border border-white/8 p-3"><Zap className="mx-auto mb-2 size-4 text-neon-cyan" /><strong className="font-display text-xl">{selectedModule.power}</strong><span className="block font-mono text-[9px] text-text-muted">{t('game.power')}</span></div><div className="rounded-lg border border-white/8 p-3"><Shield className="mx-auto mb-2 size-4 text-tertiary" /><strong className="font-display text-xl">{selectedModule.shield}</strong><span className="block font-mono text-[9px] text-text-muted">{t('game.shield')}</span></div><div className="rounded-lg border border-white/8 p-3"><BatteryCharging className="mx-auto mb-2 size-4 text-sunset" /><strong className="font-display text-xl">{selectedModule.energy}%</strong><span className="block font-mono text-[9px] text-text-muted">{t('game.energy')}</span></div></div>
          <Progress value={selectedModule.energy} tone={selectedModule.energy <= 25 ? 'magenta' : selectedModule.energy < 50 ? 'warning' : 'cyan'} label={t('game.integrity')} />
          <div className={`flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${canRepair(selectedModule) ? 'border-tertiary/25 bg-tertiary/5' : 'border-white/8 bg-white/[0.025]'}`}>
            <div className="flex items-start gap-3"><span className={`icon-chip shrink-0 ${canRepair(selectedModule) ? 'text-tertiary' : 'text-text-muted'}`}><Wrench className="size-4" /></span><div><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{t('game.repairCost')}</p>{canRepair(selectedModule) ? <strong className="mt-1 block font-display text-lg text-sunset">{selectedModule.repairCost ?? 0} SC</strong> : <p className="mt-1 text-xs text-text-muted">{selectedModule.state === 'destroyed' || selectedModule.energy === 0 ? t('error.moduleDestroyed') : t('game.fullIntegrity')}</p>}</div></div>
            <Button variant="purple" icon={Wrench} disabled={!canRepair(selectedModule)} loading={actionBusy === selectedModule.instanceId} onClick={() => void runRepair(selectedModule)}>{t('game.repair')}</Button>
          </div>
          <div className="flex justify-end"><Button variant="ghost" onClick={() => setSelectedModuleId(null)}>{t('game.closeTelemetry')}</Button></div>
        </div>}
      </Modal>
    </div>
  )
}
