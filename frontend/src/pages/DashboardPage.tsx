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
import { formatMoney, formatNumber } from '@/utils/format'
import { useI18n } from '@/i18n/I18nContext'

export function DashboardPage() {
  const { t, td } = useI18n()
  const { data, loading, createTransaction } = useAppData()
  const [formOpen, setFormOpen] = useState(false)
  if (loading || !data) return <PageSkeleton />

  const { dashboard } = data
  const progressValue = dashboard.progress.totalFlux - dashboard.progress.currentLevelFlux
  const progressMax = dashboard.progress.nextLevelFlux - dashboard.progress.currentLevelFlux

  return (
    <div className="page-enter grid gap-6">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end" data-tour="dashboard-header">
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-tertiary uppercase"><span className="status-dot text-success" />{t('dashboard.systemOnline')}</p>
          <h1 className="glitch-text font-display text-3xl font-black tracking-[-0.04em] text-neon-cyan uppercase sm:text-5xl" data-text={t('dashboard.hello', { name: dashboard.displayName })}>{t('dashboard.hello', { name: dashboard.displayName })}</h1>
          <p className="mt-2 text-sm text-text-muted">{t('dashboard.intro')}</p>
        </div>
        <SynthCard className="w-full p-4 pr-14 lg:w-72" tone="purple" helpKey="help.dashboard.flux">
          <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-wider uppercase"><span className="text-text-glow">{t('common.level', { level: dashboard.progress.level })}</span><span className="text-tertiary">{progressValue} / {progressMax} Flux</span></div>
          <Progress value={progressValue} max={progressMax} tone="purple" />
        </SynthCard>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-tour="dashboard-metrics">
        <StatCard label={t('dashboard.balance')} value={formatMoney(dashboard.balanceMinor, dashboard.currency)} detail={t('dashboard.balanceDetail')} icon={WalletCards} trend="up" tone="cyan" helpKey="help.dashboard.balance" />
        <StatCard label={t('dashboard.budgetRemaining')} value={formatMoney(dashboard.budgetRemainingMinor, dashboard.currency)} detail={t('dashboard.closureInDays', { days: 15 })} icon={Radar} tone="magenta" helpKey="help.dashboard.budgetRemaining" />
        <StatCard label="SynthCoins" value={formatNumber(dashboard.progress.synthcoins)} detail={t('dashboard.synthDetail')} icon={Coins} tone="purple" helpKey="help.dashboard.synthcoins" />
        <SynthCard className="flex min-h-40 flex-col items-center justify-center gap-4 p-5 pr-14" tone="cyan" helpKey="help.dashboard.quickEntry"><Zap className="size-7 text-neon-cyan drop-shadow-[0_0_10px_#00ffff]" /><Button className="w-full" icon={Plus} onClick={() => setFormOpen(true)}>{t('dashboard.addExpense')}</Button><p className="text-center font-mono text-[10px] text-text-muted">{t('dashboard.quickEntry')}</p></SynthCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <SynthCard className="p-5 pr-14 sm:p-6 sm:pr-16" helpKey="help.dashboard.distribution" data-tour="dashboard-distribution">
          <div className="mb-4 flex items-center gap-2"><Activity className="size-4 text-neon-cyan" /><h2 className="font-display text-sm font-bold tracking-wider uppercase">{t('dashboard.distribution')}</h2></div>
          <DonutChart data={dashboard.distribution} currency={dashboard.currency} title={t('dashboard.distribution')} />
        </SynthCard>
        <SynthCard className="p-5 pr-14 sm:p-6 sm:pr-16" helpKey="help.dashboard.recent" data-tour="dashboard-recent">
          <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><ReceiptText className="size-4 text-neon-magenta" /><h2 className="font-display text-sm font-bold tracking-wider uppercase">{t('dashboard.transmissions')}</h2></div><Link to="/gastos" className="font-mono text-[10px] text-neon-cyan hover:underline">{t('dashboard.viewAll')}</Link></div>
          <TransactionList transactions={dashboard.recentTransactions} categories={data.categories} limit={4} />
        </SynthCard>
      </div>

      <SynthCard className="p-5 pr-14 sm:p-6 sm:pr-16" helpKey="help.dashboard.cashflow" data-tour="dashboard-cashflow">
        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Activity className="size-4 text-tertiary" /><h2 className="font-display text-sm font-bold tracking-wider uppercase">{t('dashboard.monthlyFlow')}</h2></div><span className="font-mono text-[10px] text-text-muted">{t('dashboard.lastCycles', { count: 7 })}</span></div>
        <CashflowBarChart data={dashboard.cashflow} currency={dashboard.currency} />
      </SynthCard>

      <section className="grid gap-3 md:grid-cols-2">
        {dashboard.alerts.map((alert) => <div key={alert.id} className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${alert.tone === 'warning' ? 'border-sunset/25 bg-sunset/5 text-sunset' : 'border-tertiary/20 bg-tertiary/5 text-text-muted'}`}><BellRing className="mt-0.5 size-4 shrink-0" /><span>{td(alert.message)}</span></div>)}
      </section>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('dashboard.newOperation')} description={t('dashboard.operationDescription')}>
        <TransactionForm categories={data.categories} onCancel={() => setFormOpen(false)} onSubmit={async (draft) => { await createTransaction(draft); setFormOpen(false) }} />
      </Modal>
    </div>
  )
}
