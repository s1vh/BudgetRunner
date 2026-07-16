import { useState } from 'react'
import { Activity, BellRing, Coins, Plus, Radar, ReceiptText, WalletCards, Zap } from 'lucide-react'
import { Link } from 'react-router'
import { useAppData } from '@/app/AppDataContext'
import { CashflowBarChart } from '@/components/charts/CashflowBarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { TransactionList } from '@/components/transactions/TransactionList'
import { Button, Modal, PageSkeleton, Progress, SynthCard } from '@/components/ui/primitives'
import { StatCard } from '@/components/ui/StatCard'
import { formatMoney } from '@/utils/format'

export function DashboardPage() {
  const { data, loading, createTransaction } = useAppData()
  const [formOpen, setFormOpen] = useState(false)
  if (loading || !data) return <PageSkeleton />

  const { dashboard } = data
  const progressValue = dashboard.progress.totalFlux - dashboard.progress.currentLevelFlux
  const progressMax = dashboard.progress.nextLevelFlux - dashboard.progress.currentLevelFlux

  return (
    <div className="page-enter grid gap-6">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-tertiary uppercase"><span className="status-dot text-success" />{dashboard.systemStatus}</p>
          <h1 className="glitch-text font-display text-3xl font-black tracking-[-0.04em] text-neon-cyan uppercase sm:text-5xl" data-text={`Hola, ${dashboard.displayName}`}>Hola, {dashboard.displayName}</h1>
          <p className="mt-2 text-sm text-text-muted">Tu economía está sincronizada. Aquí tienes la telemetría del ciclo actual.</p>
        </div>
        <SynthCard className="w-full p-4 lg:w-72" tone="purple">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-wider uppercase"><span className="text-text-glow">LVL {dashboard.progress.level}</span><span className="text-tertiary">{progressValue} / {progressMax} Flux</span></div>
          <Progress value={progressValue} max={progressMax} tone="purple" />
        </SynthCard>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Balance total" value={formatMoney(dashboard.balanceMinor, dashboard.currency)} detail="+12% frente al ciclo anterior" icon={WalletCards} trend="up" tone="cyan" />
        <StatCard label="Presupuesto restante" value={formatMoney(dashboard.budgetRemainingMinor, dashboard.currency)} detail="15 días para el próximo cierre" icon={Radar} tone="magenta" />
        <StatCard label="SynthCoins" value={dashboard.progress.synthcoins.toLocaleString('es-ES')} detail="Saldo auditable · sin bloqueos activos" icon={Coins} tone="purple" />
        <SynthCard className="flex min-h-40 flex-col items-center justify-center gap-4 p-5" tone="cyan"><Zap className="size-7 text-neon-cyan drop-shadow-[0_0_10px_#00ffff]" /><Button className="w-full" icon={Plus} onClick={() => setFormOpen(true)}>Añadir gasto</Button><p className="text-center font-mono text-[10px] text-text-muted">Registro en menos de 30 segundos</p></SynthCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <SynthCard className="p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2"><Activity className="size-4 text-neon-cyan" /><h2 className="font-display text-sm font-bold tracking-wider uppercase">Distribución</h2></div>
          <DonutChart data={dashboard.distribution} currency={dashboard.currency} />
        </SynthCard>
        <SynthCard className="p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><ReceiptText className="size-4 text-neon-magenta" /><h2 className="font-display text-sm font-bold tracking-wider uppercase">Transmisiones</h2></div><Link to="/gastos" className="font-mono text-[10px] text-neon-cyan hover:underline">VER TODO</Link></div>
          <TransactionList transactions={dashboard.recentTransactions} limit={4} />
        </SynthCard>
      </div>

      <SynthCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity className="size-4 text-tertiary" /><h2 className="font-display text-sm font-bold tracking-wider uppercase">Flujo mensual</h2></div><span className="font-mono text-[10px] text-text-muted">ÚLTIMOS 7 CICLOS</span></div>
        <CashflowBarChart data={dashboard.cashflow} currency={dashboard.currency} />
      </SynthCard>

      <section className="grid gap-3 md:grid-cols-2">
        {dashboard.alerts.map((alert) => <div key={alert.id} className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${alert.tone === 'warning' ? 'border-sunset/25 bg-sunset/5 text-sunset' : 'border-tertiary/20 bg-tertiary/5 text-text-muted'}`}><BellRing className="mt-0.5 size-4 shrink-0" /><span>{alert.message}</span></div>)}
      </section>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nueva operación" description="PostgreSQL conservará la operación y la API devolverá los indicadores actualizados.">
        <TransactionForm categories={data.categories} onCancel={() => setFormOpen(false)} onSubmit={async (draft) => { await createTransaction(draft); setFormOpen(false) }} />
      </Modal>
    </div>
  )
}
