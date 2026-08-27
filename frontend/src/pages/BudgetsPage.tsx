import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CirclePause, Coins, History, Play, Plus, Radar, ShieldAlert } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { BudgetGauge } from '@/components/charts/BudgetGauge'
import { BudgetForm } from '@/components/forms/BudgetForm'
import { Badge, Button, Modal, PageSkeleton, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import { useI18n } from '@/i18n/I18nContext'
import { categoryLabel } from '@/i18n/categoryLabel'
import type { TranslationKey } from '@/i18n/messages'
import type { Budget, BudgetPeriod, BudgetStatus, Category } from '@/types/domain'
import { formatDate, formatMoney } from '@/utils/format'
import { useBudgetsQuery, useCategoriesQuery } from '@/app/dataQueries'
import { DataQueryState } from '@/components/routing/DataQueryState'

const emptyBudgets: Budget[] = []
const emptyCategories: Category[] = []

const statusMeta: Record<BudgetStatus, { labelKey: TranslationKey; tone: 'cyan' | 'magenta' | 'purple' | 'success' | 'warning' | 'muted' }> = {
  active: { labelKey: 'budget.active', tone: 'cyan' },
  scheduled: { labelKey: 'budget.scheduled', tone: 'purple' },
  paused: { labelKey: 'budget.paused', tone: 'warning' },
  met: { labelKey: 'budget.met', tone: 'success' },
  exceeded: { labelKey: 'budget.exceeded', tone: 'magenta' },
  archived: { labelKey: 'budget.archived', tone: 'muted' },
}

export function BudgetsPage() {
  const { t, td } = useI18n()
  const { createBudget, pauseBudget, resumeBudget, loadBudgetPeriods } = useAppData()
  const budgetsQuery = useBudgetsQuery()
  const categoriesQuery = useCategoriesQuery()
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Budget | null>(null)
  const [periods, setPeriods] = useState<BudgetPeriod[] | null>(null)
  const [periodsLoading, setPeriodsLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | BudgetStatus>('all')
  const budgets = budgetsQuery.data ?? emptyBudgets
  const categories = categoriesQuery.data ?? emptyCategories
  const visible = useMemo(() => budgets.filter((budget) => filter === 'all' || budget.status === filter), [budgets, filter])
  const pending = budgetsQuery.isPending || categoriesQuery.isPending
  const failed = budgetsQuery.isError || categoriesQuery.isError
  if (pending || failed || !budgetsQuery.data || !categoriesQuery.data) return <DataQueryState pending={pending} error={failed} retry={() => { void budgetsQuery.refetch(); void categoriesQuery.refetch() }}><PageSkeleton /></DataQueryState>

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow={t('budgets.eyebrow')} title={t('budgets.title')} description={t('budgets.description')} icon={Radar} tourId="budgets-header" actions={<Button icon={Plus} onClick={() => setFormOpen(true)}>{t('budgets.new')}</Button>} />
      <div className="flex flex-wrap gap-2" aria-label={t('budgets.filter')} data-tour="budgets-filters">
        {(['all', 'active', 'scheduled', 'met', 'exceeded', 'paused'] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`min-h-10 rounded-lg border px-3 font-mono text-[10px] font-bold uppercase transition ${filter === item ? 'border-neon-cyan/50 bg-neon-cyan/8 text-neon-cyan' : 'border-white/10 text-text-muted hover:text-text-glow'}`}>{item === 'all' ? t('common.all') : t(statusMeta[item].labelKey)}</button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-tour="budgets-cards">
        {visible.map((budget) => {
          const status = statusMeta[budget.status]
          const over = budget.spendMinor > budget.limitMinor
          const budgetCategory = budget.categoryId ? categories.find((category) => category.id === budget.categoryId) : undefined
          const categoryName = budgetCategory ? categoryLabel(budgetCategory, td) : budget.categoryName
          return (
            <SynthCard key={budget.id} interactive tone={over ? 'danger' : budget.status === 'met' ? 'cyan' : 'default'} className="flex min-h-72 flex-col p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">{budget.frequency === 'weekly' ? t('budget.weeklyCycle') : t('budget.monthlyCycle')} · {budget.scope === 'global' ? t('budget.global') : categoryName}</p><h2 className="mt-1 font-heading text-lg font-bold text-text-glow">{budget.name}</h2></div><Badge tone={status.tone}>{t(status.labelKey)}</Badge></div>
              <div className="my-6"><BudgetGauge spendMinor={budget.spendMinor} limitMinor={budget.limitMinor} currency={budget.currency} /></div>
              <div className="grid grid-cols-2 gap-3 border-y border-outline-soft/45 py-3 font-mono text-[10px]"><div><span className="block text-text-muted">{t('budget.start')}</span><strong className="mt-1 block text-text-glow">{formatDate(budget.startsAt)}</strong></div><div><span className="block text-text-muted">{t('budget.close')}</span><strong className="mt-1 block text-text-glow">{formatDate(budget.endsAt)}</strong></div></div>
              <div className="mt-4 flex flex-1 items-end justify-between gap-3"><div className="text-xs text-text-muted">{budget.status === 'met' ? <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" />+{budget.synthcoinsAwarded} SC · +{budget.fluxAwarded} Flux</span> : over ? <span className="flex items-center gap-1.5 text-neon-magenta"><ShieldAlert className="size-4" />{t('budget.penaltyRisk')}</span> : <span>{t('budget.eligible', { amount: formatMoney(budget.eligibleSurplusMinor, budget.currency) })}</span>}</div><button type="button" onClick={() => { setSelected(budget); setPeriods(null) }} className="min-h-10 rounded-lg px-3 font-mono text-[10px] text-neon-cyan hover:bg-neon-cyan/7">{t('common.details')}</button></div>
            </SynthCard>
          )
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('budgets.new')} description={t('budget.newDescription')}><BudgetForm categories={categories} onCancel={() => setFormOpen(false)} onSubmit={async (draft) => { await createBudget(draft); setFormOpen(false) }} /></Modal>
      <Modal open={Boolean(selected)} onClose={() => { setSelected(null); setPeriods(null) }} title={selected?.name ?? t('budget.detailTitle')} description={t('budget.snapshot')}>
        {selected && <div className="grid gap-5">
          <BudgetGauge spendMinor={selected.spendMinor} limitMinor={selected.limitMinor} currency={selected.currency} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/8 p-3"><Coins className="mb-2 size-4 text-sunset" /><span className="block font-mono text-[10px] text-text-muted">{t('budget.eligible', { amount: '' })}</span><strong className="font-mono text-sm">{formatMoney(selected.eligibleSurplusMinor, selected.currency)}</strong></div>
            <div className="rounded-lg border border-white/8 p-3"><History className="mb-2 size-4 text-tertiary" /><span className="block font-mono text-[10px] text-text-muted">{t('budget.excluded')}</span><strong className="font-mono text-sm">{formatMoney(selected.excludedRewardMinor ?? 0, selected.currency)}</strong></div>
            <div className="rounded-lg border border-white/8 p-3"><CalendarDays className="mb-2 size-4 text-neon-cyan" /><span className="block font-mono text-[10px] text-text-muted">{t('budget.frequency')}</span><strong className="font-mono text-sm">{selected.frequency === 'weekly' ? t('budget.weekly') : t('budget.monthly')}</strong></div>
          </div>
          <div className="rounded-lg border border-outline-soft/60 bg-void/40 p-4 text-sm leading-6 text-text-muted">{t('budget.rewardNote')}</div>
          {periods && <div className="grid max-h-64 gap-2 overflow-auto">{periods.map((period) => <div key={period.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-white/8 p-3 text-xs"><span><strong className="block text-text-glow">{formatDate(period.startsAt)} — {formatDate(period.endsAt)}</strong><small className="text-text-muted">{formatMoney(period.spendMinor, selected.currency)} · {period.status}</small></span><span className="text-right font-mono text-neon-cyan">+{period.synthcoinsAwarded} SC<br />+{period.fluxAwarded} Flux</span></div>)}</div>}
          <div className="flex flex-wrap justify-end gap-3">
            {(selected.status === 'active' || selected.status === 'scheduled' || selected.status === 'paused') && <Button variant="ghost" icon={selected.status === 'paused' ? Play : CirclePause} onClick={async () => { if (selected.status === 'paused') await resumeBudget(selected.id); else await pauseBudget(selected.id); setSelected(null) }}>{selected.status === 'paused' ? t('budget.resume') : t('budget.pause')}</Button>}
            <Button variant="purple" icon={History} loading={periodsLoading} onClick={async () => { setPeriodsLoading(true); try { setPeriods(await loadBudgetPeriods(selected.id)) } finally { setPeriodsLoading(false) } }}>{t('budget.viewPeriods')}</Button>
          </div>
        </div>}
      </Modal>
    </div>
  )
}
