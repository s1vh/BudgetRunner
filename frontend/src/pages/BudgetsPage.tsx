import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CirclePause, Coins, History, Pause, Plus, Radar, ShieldAlert } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { BudgetGauge } from '@/components/charts/BudgetGauge'
import { BudgetForm } from '@/components/forms/BudgetForm'
import { Badge, Button, Modal, PageSkeleton, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Budget, BudgetStatus } from '@/types/domain'
import { formatDate, formatMoney } from '@/utils/format'

const statusMeta: Record<BudgetStatus, { label: string; tone: 'cyan' | 'magenta' | 'purple' | 'success' | 'warning' | 'muted' }> = {
  active: { label: 'Activo', tone: 'cyan' }, scheduled: { label: 'Programado', tone: 'purple' }, paused: { label: 'Pausado', tone: 'warning' }, met: { label: 'Cumplido', tone: 'success' }, exceeded: { label: 'Excedido', tone: 'magenta' }, archived: { label: 'Archivado', tone: 'muted' },
}

export function BudgetsPage() {
  const { data, loading, createBudget } = useAppData()
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Budget | null>(null)
  const [filter, setFilter] = useState<'all' | BudgetStatus>('all')
  const visible = useMemo(() => data?.budgets.filter((budget) => filter === 'all' || budget.status === filter) ?? [], [data, filter])
  if (loading || !data) return <PageSkeleton />

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow="Control de ciclo" title="Presupuestos" description="Límites semanales y mensuales con trazabilidad de cierres, solapamientos y recompensas elegibles." icon={Radar} actions={<Button icon={Plus} onClick={() => setFormOpen(true)}>Nuevo presupuesto</Button>} />
      <div className="flex flex-wrap gap-2" aria-label="Filtrar presupuestos">
        {(['all', 'active', 'scheduled', 'met', 'exceeded', 'paused'] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-10 rounded-lg border px-3 font-mono text-[10px] font-bold uppercase transition ${filter === item ? 'border-neon-cyan/50 bg-neon-cyan/8 text-neon-cyan' : 'border-white/10 text-text-muted hover:text-text-glow'}`}>{item === 'all' ? 'Todos' : statusMeta[item].label}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((budget) => {
          const status = statusMeta[budget.status]
          const over = budget.spendMinor > budget.limitMinor
          return (
            <SynthCard key={budget.id} interactive tone={over ? 'danger' : budget.status === 'met' ? 'cyan' : 'default'} className="flex min-h-72 flex-col p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{budget.frequency === 'weekly' ? 'Ciclo semanal' : 'Ciclo mensual'} · {budget.scope === 'global' ? 'Global' : budget.categoryName}</p><h2 className="mt-1 font-heading text-lg font-bold text-text-glow">{budget.name}</h2></div><Badge tone={status.tone}>{status.label}</Badge></div>
              <div className="my-6"><BudgetGauge spendMinor={budget.spendMinor} limitMinor={budget.limitMinor} currency={budget.currency} /></div>
              <div className="grid grid-cols-2 gap-3 border-y border-outline-soft/45 py-3 font-mono text-[10px]"><div><span className="block text-text-muted">INICIO</span><strong className="mt-1 block text-text-glow">{formatDate(budget.startsAt)}</strong></div><div><span className="block text-text-muted">CIERRE</span><strong className="mt-1 block text-text-glow">{formatDate(budget.endsAt)}</strong></div></div>
              <div className="mt-4 flex flex-1 items-end justify-between gap-3"><div className="text-xs text-text-muted">{budget.status === 'met' ? <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" />+{budget.synthcoinsAwarded} SC · +{budget.fluxAwarded} Flux</span> : over ? <span className="flex items-center gap-1.5 text-neon-magenta"><ShieldAlert className="size-4" />Riesgo de penalización</span> : <span>Elegible: {formatMoney(budget.eligibleSurplusMinor, budget.currency)}</span>}</div><button type="button" onClick={() => setSelected(budget)} className="min-h-10 rounded-lg px-3 font-mono text-[10px] text-neon-cyan hover:bg-neon-cyan/7">DETALLE</button></div>
            </SynthCard>
          )
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nuevo presupuesto" description="Configura el ciclo; las reglas de cierre seguirán siendo responsabilidad del backend."><BudgetForm categories={data.categories} onCancel={() => setFormOpen(false)} onSubmit={async (draft) => { await createBudget(draft); setFormOpen(false) }} /></Modal>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? 'Detalle de presupuesto'} description="Snapshot de periodo y trazabilidad de recompensa.">
        {selected && <div className="grid gap-5"><BudgetGauge spendMinor={selected.spendMinor} limitMinor={selected.limitMinor} currency={selected.currency} /><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-white/8 p-3"><Coins className="mb-2 size-4 text-sunset" /><span className="block font-mono text-[10px] text-text-muted">ELEGIBLE</span><strong className="font-mono text-sm">{formatMoney(selected.eligibleSurplusMinor, selected.currency)}</strong></div><div className="rounded-lg border border-white/8 p-3"><History className="mb-2 size-4 text-tertiary" /><span className="block font-mono text-[10px] text-text-muted">EXCLUIDO</span><strong className="font-mono text-sm">{formatMoney(selected.excludedRewardMinor ?? 0, selected.currency)}</strong></div><div className="rounded-lg border border-white/8 p-3"><CalendarDays className="mb-2 size-4 text-neon-cyan" /><span className="block font-mono text-[10px] text-text-muted">FRECUENCIA</span><strong className="font-mono text-sm">{selected.frequency === 'weekly' ? 'Semanal' : 'Mensual'}</strong></div></div><div className="rounded-lg border border-outline-soft/60 bg-void/40 p-4 text-sm leading-6 text-text-muted">Los gastos ya recompensados continúan apareciendo en el cálculo informativo, pero su porción se excluye del excedente elegible. El ledger del backend conservará cada atribución.</div><div className="flex flex-wrap justify-end gap-3"><Button variant="ghost" icon={CirclePause}>Pausar</Button><Button variant="purple" icon={Pause}>Ver periodos</Button></div></div>}
      </Modal>
    </div>
  )
}
