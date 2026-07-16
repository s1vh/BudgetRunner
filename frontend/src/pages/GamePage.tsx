import { useMemo, useState } from 'react'
import { BatteryCharging, Coins, Cpu, Gamepad2, History, LockKeyhole, PackageOpen, Shield, ShoppingBag, Sparkles, Wrench, Zap } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { CyberdeckDiagram, familyColors } from '@/components/game/CyberdeckDiagram'
import { ModuleCard } from '@/components/game/ModuleCard'
import { Badge, Button, Modal, PageSkeleton, Progress, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import type { CyberModule, StoreOffer } from '@/types/domain'
import { formatDate } from '@/utils/format'

type GameTab = 'summary' | 'deck' | 'store' | 'repairs' | 'history'
const tabs: Array<{ id: GameTab; label: string; icon: typeof Gamepad2 }> = [
  { id: 'summary', label: 'Resumen', icon: Gamepad2 }, { id: 'deck', label: 'Cyberdeck', icon: Cpu }, { id: 'store', label: 'Tienda', icon: ShoppingBag }, { id: 'repairs', label: 'Reparaciones', icon: Wrench }, { id: 'history', label: 'Registro', icon: History },
]

export function GamePage() {
  const { data, loading } = useAppData()
  const [tab, setTab] = useState<GameTab>('summary')
  const [selectedModule, setSelectedModule] = useState<CyberModule | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<StoreOffer | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const repairable = useMemo(() => data?.game.modules.filter((module) => module.energy > 0 && module.energy < 100) ?? [], [data])
  if (loading || !data) return <PageSkeleton />
  const { game } = data
  const progressValue = game.progress.totalFlux - game.progress.currentLevelFlux
  const progressMax = game.progress.nextLevelFlux - game.progress.currentLevelFlux

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow="Sistema de progresión" title="Gamificación & Cyberdeck" description="Convierte tus ciclos financieros en Power, Flux y una construcción tecnológica persistente." icon={Gamepad2} />
      {notice && <button type="button" onClick={() => setNotice(null)} className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3 text-left text-sm text-neon-cyan">{notice}</button>}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 font-mono text-[10px] font-bold uppercase transition ${tab === id ? 'border-neon-cyan/45 bg-neon-cyan/8 text-neon-cyan' : 'border-white/10 text-text-muted hover:text-text-glow'}`}><Icon className="size-4" />{label}</button>)}
      </div>

      {tab === 'summary' && <section className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[{ label: 'Nivel', value: game.progress.level, icon: Sparkles, color: 'text-neon-cyan' }, { label: 'SynthCoins', value: game.progress.synthcoins.toLocaleString('es-ES'), icon: Coins, color: 'text-sunset' }, { label: 'Power activo', value: game.progress.activePower, icon: Zap, color: 'text-neon-magenta' }, { label: 'Bonus familias', value: `+${game.progress.familyBonusPower}`, icon: Shield, color: 'text-tertiary' }].map(({ label, value, icon: Icon, color }) => <SynthCard key={label} className="p-5"><div className="flex items-center justify-between"><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{label}</p><Icon className={`size-4 ${color}`} /></div><strong className={`mt-3 block font-display text-3xl tabular ${color}`}>{value}</strong></SynthCard>)}
        </div>
        <SynthCard className="p-5 sm:p-6" tone="purple"><div className="mb-3 flex items-end justify-between"><div><p className="font-mono text-[10px] text-text-muted uppercase">Flux total</p><strong className="font-display text-2xl text-tertiary">{game.progress.totalFlux}</strong></div><span className="font-mono text-xs text-text-muted">Nivel {game.progress.level + 1} · {game.progress.nextLevelFlux}</span></div><Progress value={progressValue} max={progressMax} tone="purple" label={`${progressValue} de ${progressMax} Flux`} /><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">FLUX BASE</span><strong className="block text-lg">{game.progress.baseFlux}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">POWER</span><strong className="block text-lg">+{game.progress.activePower}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="font-mono text-[10px] text-text-muted">BONUS</span><strong className="block text-lg">+{game.progress.familyBonusPower}</strong></div></div></SynthCard>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{game.familyBonuses.map((bonus) => <SynthCard key={bonus.family} className="p-4"><div className="mb-3 flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: familyColors[bonus.family], boxShadow: `0 0 8px ${familyColors[bonus.family]}` }} /><strong className="font-display text-xs uppercase" style={{ color: familyColors[bonus.family] }}>{bonus.family.replace('_', ' ')}</strong></div><p className="font-mono text-[10px] text-text-muted">{bonus.count} módulos · {bonus.power} Power</p><p className="mt-2 text-sm">Bonus activo: <span className="font-mono text-tertiary">+{bonus.bonus}</span></p></SynthCard>)}</div>
      </section>}

      {tab === 'deck' && <section className="grid gap-4"><SynthCard className="p-3 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-display text-sm font-bold uppercase">Esquema técnico · 10 slots</h2><p className="mt-1 text-xs text-text-muted">Selecciona un módulo para inspeccionar su telemetría.</p></div><Badge tone="cyan">{game.modules.filter((module) => module.state === 'equipped').length}/10 online</Badge></div><CyberdeckDiagram modules={game.modules} selectedId={selectedModule?.instanceId} onSelect={setSelectedModule} /></SynthCard></section>}

      {tab === 'store' && <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-text-muted">Rotación reproducible · 6 ofertas · expira {formatDate(game.offers[0].expiresAt)}</p><Badge tone="success"><PackageOpen className="size-3" />Compras disponibles</Badge></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{game.offers.map((offer) => <ModuleCard key={offer.id} module={offer.module} footer={<div className="flex items-center justify-between gap-3"><div><span className="block font-mono text-[9px] text-text-muted">COSTE NETO</span><strong className="font-display text-lg text-sunset">{offer.netCost} SC</strong></div><Button className="px-3 text-[10px]" variant={offer.minLevel > game.progress.level ? 'ghost' : 'cyan'} disabled={offer.minLevel > game.progress.level} onClick={(event) => { event.stopPropagation(); setSelectedOffer(offer) }}>{offer.minLevel > game.progress.level ? `Nivel ${offer.minLevel}` : 'Comprar'}</Button></div>} />)}</div></section>}

      {tab === 'repairs' && <section><div className="mb-4 rounded-lg border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-text-muted"><BatteryCharging className="mr-2 inline size-4 text-tertiary" />Las reparaciones siguen disponibles durante un bloqueo de compras. Los destruidos no son reparables.</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{repairable.map((module) => { const cost = Math.ceil(module.priceCoins * ((100 - module.energy) / 100)); return <ModuleCard key={module.instanceId} module={module} footer={<div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-sunset">{cost} SC</span><Button variant="purple" icon={Wrench} className="px-3 text-[10px]" onClick={(event) => { event.stopPropagation(); setNotice(`${module.name}: reparación simulada. La futura API recalculará y confirmará el coste.`) }}>Reparar</Button></div>} />})}</div></section>}

      {tab === 'history' && <SynthCard className="overflow-hidden"><ul className="divide-y divide-outline-soft/50">{game.history.map((event) => <li key={event.id} className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"><span className="icon-chip text-tertiary"><History className="size-4" /></span><span><strong className="block text-sm">{event.title}</strong><small className="text-text-muted">{event.detail}</small></span><span className="font-mono text-xs text-text-muted">{formatDate(event.occurredAt)}{event.amount !== undefined && <strong className={`ml-3 ${event.amount > 0 ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{event.amount > 0 ? '+' : ''}{event.amount} SC</strong>}</span></li>)}</ul></SynthCard>}

      <Modal open={Boolean(selectedModule)} onClose={() => setSelectedModule(null)} title={selectedModule?.name ?? 'Módulo'} description={selectedModule?.description}>
        {selectedModule && <div className="grid gap-5"><div className="grid grid-cols-3 gap-3 text-center"><div className="rounded-lg border border-white/8 p-3"><Zap className="mx-auto mb-2 size-4 text-neon-cyan" /><strong className="font-display text-xl">{selectedModule.power}</strong><span className="block font-mono text-[9px] text-text-muted">POWER</span></div><div className="rounded-lg border border-white/8 p-3"><Shield className="mx-auto mb-2 size-4 text-tertiary" /><strong className="font-display text-xl">{selectedModule.shield}</strong><span className="block font-mono text-[9px] text-text-muted">SHIELD</span></div><div className="rounded-lg border border-white/8 p-3"><BatteryCharging className="mx-auto mb-2 size-4 text-sunset" /><strong className="font-display text-xl">{selectedModule.energy}%</strong><span className="block font-mono text-[9px] text-text-muted">ENERGY</span></div></div><Progress value={selectedModule.energy} tone={selectedModule.energy <= 25 ? 'magenta' : selectedModule.energy < 50 ? 'warning' : 'cyan'} label="Integridad del módulo" /><Button variant="ghost" onClick={() => setSelectedModule(null)}>Cerrar telemetría</Button></div>}
      </Modal>

      <Modal open={Boolean(selectedOffer)} onClose={() => setSelectedOffer(null)} title={`Adquirir ${selectedOffer?.module.name ?? ''}`} description="La estimación se presenta al usuario, pero el backend recalculará precio, entrega, nivel y bloqueo dentro de una transacción.">
        {selectedOffer && <div className="grid gap-5"><div className="grid grid-cols-3 gap-3 font-mono text-center text-xs"><div className="rounded-lg border border-white/8 p-3"><span className="text-text-muted">PRECIO</span><strong className="mt-2 block text-lg">{selectedOffer.module.priceCoins}</strong></div><div className="rounded-lg border border-white/8 p-3"><span className="text-text-muted">ENTREGA</span><strong className="mt-2 block text-lg text-tertiary">−{selectedOffer.tradeInValue}</strong></div><div className="rounded-lg border border-sunset/20 p-3"><span className="text-text-muted">NETO</span><strong className="mt-2 block text-lg text-sunset">{selectedOffer.netCost}</strong></div></div><div className="flex items-center gap-2 rounded-lg border border-neon-magenta/20 bg-neon-magenta/5 p-3 text-xs text-text-muted"><LockKeyhole className="size-4 shrink-0 text-neon-magenta" />La confirmación real requerirá `Idempotency-Key`.</div><div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setSelectedOffer(null)}>Cancelar</Button><Button icon={Coins} onClick={() => { setNotice('Compra simulada registrada en la interfaz. No se ha alterado ningún saldo económico.'); setSelectedOffer(null) }}>Confirmar mockup</Button></div></div>}
      </Modal>
    </div>
  )
}
