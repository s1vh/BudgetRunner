import { useMemo, useState } from 'react'
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  CirclePause,
  Coins,
  Edit3,
  History,
  Play,
  Plus,
  Radar,
  ShieldAlert,
} from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { useBudgetPeriodsQuery, useBudgetsQuery, useCategoriesQuery } from '@/app/dataQueries'
import { BudgetGauge } from '@/components/charts/BudgetGauge'
import { BudgetForm } from '@/components/forms/BudgetForm'
import { DataQueryState } from '@/components/routing/DataQueryState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, Button, EmptyState, Modal, PageSkeleton, SynthCard } from '@/components/ui/primitives'
import { categoryLabel } from '@/i18n/categoryLabel'
import { useI18n } from '@/i18n/I18nContext'
import type { TranslationKey } from '@/i18n/messages'
import type { Budget, BudgetPeriodStatus, BudgetStatus, BudgetUpdate, Category } from '@/types/domain'
import { formatDate, formatMoney } from '@/utils/format'

const emptyBudgets: Budget[] = []
const emptyCategories: Category[] = []

type BadgeTone = 'cyan' | 'magenta' | 'purple' | 'success' | 'warning' | 'muted'

const statusMeta: Record<BudgetStatus, { labelKey: TranslationKey; tone: BadgeTone }> = {
  active: { labelKey: 'budget.active', tone: 'cyan' },
  scheduled: { labelKey: 'budget.scheduled', tone: 'purple' },
  paused: { labelKey: 'budget.paused', tone: 'warning' },
  met: { labelKey: 'budget.met', tone: 'success' },
  exceeded: { labelKey: 'budget.exceeded', tone: 'magenta' },
  archived: { labelKey: 'budget.archived', tone: 'muted' },
}

const periodStatusMeta: Record<BudgetPeriodStatus, { labelKey: TranslationKey; tone: BadgeTone }> = {
  open: { labelKey: 'budget.periodOpen', tone: 'cyan' },
  processing: { labelKey: 'budget.periodProcessing', tone: 'warning' },
  met: { labelKey: 'budget.met', tone: 'success' },
  exceeded: { labelKey: 'budget.exceeded', tone: 'magenta' },
  closed: { labelKey: 'budget.periodClosed', tone: 'muted' },
  cancelled: { labelKey: 'budget.periodCancelled', tone: 'muted' },
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function BudgetsPage() {
  const { t, td } = useI18n()
  const { profile, createBudget, updateBudget, pauseBudget, resumeBudget, archiveBudget } = useAppData()
  const budgetsQuery = useBudgetsQuery()
  const categoriesQuery = useCategoriesQuery()
  const [editor, setEditor] = useState<'new' | Budget | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'pause' | 'resume' | 'archive' | null>(null)
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [filter, setFilter] = useState<'all' | BudgetStatus>('all')
  const budgets = budgetsQuery.data ?? emptyBudgets
  const categories = categoriesQuery.data ?? emptyCategories
  const selected = budgets.find((budget) => budget.id === selectedId) ?? null
  const selectedTimeZone = selected?.timezone ?? profile?.timezone
  const archiveTarget = budgets.find((budget) => budget.id === archiveTargetId) ?? null
  const periodsQuery = useBudgetPeriodsQuery(selectedId, historyOpen)
  const visible = useMemo(
    () => budgets.filter((budget) => filter === 'all' || budget.status === filter),
    [budgets, filter],
  )
  const pending = budgetsQuery.isPending || categoriesQuery.isPending
  const failed = budgetsQuery.isError || categoriesQuery.isError

  if (pending || failed || !budgetsQuery.data || !categoriesQuery.data) {
    return (
      <DataQueryState pending={pending} error={failed} retry={() => { void budgetsQuery.refetch(); void categoriesQuery.refetch() }}>
        <PageSkeleton />
      </DataQueryState>
    )
  }

  async function changeBudgetState(action: 'pause' | 'resume') {
    if (!selected) return
    setBusyAction(action)
    setFeedback(null)
    try {
      if (action === 'pause') await pauseBudget(selected.id)
      else await resumeBudget(selected.id)
      setFeedback({ tone: 'success', message: t(action === 'pause' ? 'budget.pausedFeedback' : 'budget.resumedFeedback') })
    } catch (error) {
      setFeedback({ tone: 'error', message: errorText(error, t('error.requestFailed')) })
    } finally {
      setBusyAction(null)
    }
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setBusyAction('archive')
    setFeedback(null)
    try {
      await archiveBudget(archiveTarget.id)
      setFeedback({ tone: 'success', message: t('budget.archivedFeedback') })
      setArchiveTargetId(null)
    } catch (error) {
      setFeedback({ tone: 'error', message: errorText(error, t('error.requestFailed')) })
    } finally {
      setBusyAction(null)
    }
  }

  function openDetails(budget: Budget) {
    setSelectedId(budget.id)
    setHistoryOpen(false)
  }

  function closeDetails() {
    setSelectedId(null)
    setHistoryOpen(false)
  }

  return (
    <div className="page-enter grid gap-6">
      <PageHeader
        eyebrow={t('budgets.eyebrow')}
        title={t('budgets.title')}
        description={t('budgets.description')}
        icon={Radar}
        tourId="budgets-header"
        actions={<Button icon={Plus} onClick={() => setEditor('new')}>{t('budgets.new')}</Button>}
      />

      {feedback && (
        <button
          type="button"
          onClick={() => setFeedback(null)}
          className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm ${feedback.tone === 'error' ? 'border-neon-magenta/25 bg-neon-magenta/5 text-neon-magenta' : 'border-neon-cyan/25 bg-neon-cyan/5 text-neon-cyan'}`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          <span>{feedback.message}</span>
          <span className="font-mono text-[10px]">{t('common.close')}</span>
        </button>
      )}

      <div className="flex flex-wrap gap-2" aria-label={t('budgets.filter')} data-tour="budgets-filters">
        {(['all', 'active', 'scheduled', 'paused', 'archived'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`min-h-10 rounded-lg border px-3 font-mono text-[10px] font-bold uppercase transition ${filter === item ? 'border-neon-cyan/50 bg-neon-cyan/8 text-neon-cyan' : 'border-white/10 text-text-muted hover:text-text-glow'}`}
          >
            {item === 'all' ? t('common.all') : t(statusMeta[item].labelKey)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" data-tour="budgets-cards">
        {visible.map((budget) => {
          const status = statusMeta[budget.status]
          const over = budget.spendMinor > budget.limitMinor
          const budgetCategory = budget.categoryId ? categories.find((category) => category.id === budget.categoryId) : undefined
          const categoryName = budgetCategory ? categoryLabel(budgetCategory, td) : budget.categoryName
          const budgetTimeZone = budget.timezone ?? profile?.timezone
          return (
            <SynthCard key={budget.id} interactive tone={over ? 'danger' : budget.status === 'met' ? 'cyan' : 'default'} className="flex min-h-72 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] tracking-wider text-text-muted uppercase">
                    {budget.frequency === 'weekly' ? t('budget.weeklyCycle') : t('budget.monthlyCycle')} · {budget.scope === 'global' ? t('budget.global') : categoryName}
                  </p>
                  <h2 className="mt-1 font-heading text-lg font-bold text-text-glow">{budget.name}</h2>
                </div>
                <Badge tone={status.tone}>{t(status.labelKey)}</Badge>
              </div>
              <div className="my-6"><BudgetGauge spendMinor={budget.spendMinor} limitMinor={budget.limitMinor} currency={budget.currency} /></div>
              <div className="grid grid-cols-2 gap-3 border-y border-outline-soft/45 py-3 font-mono text-[10px]">
                <div><span className="block text-text-muted">{t('budget.start')}</span><strong className="mt-1 block text-text-glow">{formatDate(budget.startsAt, undefined, budgetTimeZone)}</strong></div>
                <div><span className="block text-text-muted">{t('budget.close')}</span><strong className="mt-1 block text-text-glow">{formatDate(budget.endsAt, undefined, budgetTimeZone)}</strong></div>
              </div>
              <div className="mt-4 flex flex-1 items-end justify-between gap-3">
                <div className="text-xs text-text-muted">
                  {budget.status === 'met' ? (
                    <span className="flex items-center gap-1.5 text-success"><CheckCircle2 className="size-4" />+{budget.synthcoinsAwarded ?? 0} SC · +{budget.fluxAwarded ?? 0} Flux</span>
                  ) : over ? (
                    <span className="flex items-center gap-1.5 text-neon-magenta"><ShieldAlert className="size-4" />{t('budget.penaltyRisk')}</span>
                  ) : (
                    <span>{t('budget.eligible', { amount: formatMoney(budget.eligibleSurplusMinor, budget.currency) })}</span>
                  )}
                </div>
                <button type="button" onClick={() => openDetails(budget)} className="min-h-10 rounded-lg px-3 font-mono text-[10px] text-neon-cyan hover:bg-neon-cyan/7">{t('common.details')}</button>
              </div>
            </SynthCard>
          )
        })}

        {visible.length === 0 && (
          <SynthCard className="lg:col-span-2 xl:col-span-3">
            <EmptyState icon={Radar} title={t('budget.emptyTitle')} description={t('budget.emptyDescription')} action={<Button icon={Plus} onClick={() => setEditor('new')}>{t('budgets.new')}</Button>} />
          </SynthCard>
        )}
      </div>

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor === 'new' ? t('budgets.new') : t('budget.editTitle')}
        description={editor === 'new' ? t('budget.newDescription') : t('budget.editDescription')}
      >
        {editor && (
          <BudgetForm
            key={editor === 'new' ? 'new-budget' : editor.id}
            categories={categories}
            initial={editor === 'new' ? undefined : editor}
            defaultCurrency={profile?.primaryCurrency}
            defaultTimezone={profile?.timezone}
            onCancel={() => setEditor(null)}
            onSubmit={async (draft) => {
              if (editor === 'new') {
                await createBudget(draft)
                setFeedback({ tone: 'success', message: t('budget.createdFeedback') })
              } else {
                const update: BudgetUpdate = {
                  name: draft.name,
                  frequency: draft.frequency,
                  scope: draft.scope,
                  categoryId: draft.scope === 'category' ? draft.categoryId : null,
                  limitMinor: draft.limitMinor,
                  currency: draft.currency,
                }
                await updateBudget(editor.id, update)
                setFeedback({ tone: 'success', message: t('budget.updatedFeedback') })
              }
              setEditor(null)
            }}
          />
        )}
      </Modal>

      <Modal open={Boolean(selected)} onClose={closeDetails} title={selected?.name ?? t('budget.detailTitle')} description={t('budget.snapshot')}>
        {selected && (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={statusMeta[selected.status].tone}>{t(statusMeta[selected.status].labelKey)}</Badge>
              <span className="font-mono text-[10px] text-text-muted">{formatDate(selected.startsAt, undefined, selectedTimeZone)} — {formatDate(selected.endsAt, undefined, selectedTimeZone)}</span>
            </div>
            <BudgetGauge spendMinor={selected.spendMinor} limitMinor={selected.limitMinor} currency={selected.currency} />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/8 p-3"><Coins className="mb-2 size-4 text-sunset" /><span className="block font-mono text-[10px] text-text-muted">{t('budget.eligibleLabel')}</span><strong className="font-mono text-sm">{formatMoney(selected.eligibleSurplusMinor, selected.currency)}</strong></div>
              <div className="rounded-lg border border-white/8 p-3"><History className="mb-2 size-4 text-tertiary" /><span className="block font-mono text-[10px] text-text-muted">{t('budget.excluded')}</span><strong className="font-mono text-sm">{formatMoney(selected.excludedRewardMinor ?? 0, selected.currency)}</strong></div>
              <div className="rounded-lg border border-white/8 p-3"><CalendarDays className="mb-2 size-4 text-neon-cyan" /><span className="block font-mono text-[10px] text-text-muted">{t('budget.frequency')}</span><strong className="font-mono text-sm">{selected.frequency === 'weekly' ? t('budget.weekly') : t('budget.monthly')}</strong></div>
            </div>
            <div className="rounded-lg border border-outline-soft/60 bg-void/40 p-4 text-sm leading-6 text-text-muted">{t('budget.rewardNote')}</div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-outline-soft/60 pt-4">
              {selected.status !== 'archived' && <Button variant="ghost" icon={Edit3} onClick={() => { setEditor(selected); closeDetails() }}>{t('common.edit')}</Button>}
              {(selected.status === 'active' || selected.status === 'scheduled') && <Button variant="ghost" icon={CirclePause} loading={busyAction === 'pause'} onClick={() => void changeBudgetState('pause')}>{t('budget.pause')}</Button>}
              {selected.status === 'paused' && <Button variant="ghost" icon={Play} loading={busyAction === 'resume'} onClick={() => void changeBudgetState('resume')}>{t('budget.resume')}</Button>}
              {selected.status !== 'archived' && <Button variant="magenta" icon={Archive} onClick={() => { setArchiveTargetId(selected.id); closeDetails() }}>{t('budget.archive')}</Button>}
              <Button variant="purple" icon={History} onClick={() => setHistoryOpen((current) => !current)}>{historyOpen ? t('budget.hidePeriods') : t('budget.viewPeriods')}</Button>
            </div>

            {historyOpen && (
              <section className="grid gap-3 border-t border-outline-soft/60 pt-5" aria-live="polite">
                <h3 className="font-display text-sm font-bold tracking-wider text-text-glow uppercase">{t('budget.periodHistory')}</h3>
                {periodsQuery.isPending && <p className="py-5 text-center font-mono text-xs text-text-muted">{t('budget.loadingPeriods')}</p>}
                {periodsQuery.isError && (
                  <div className="rounded-lg border border-neon-magenta/25 bg-neon-magenta/5 p-4 text-sm text-neon-magenta">
                    <p>{t('budget.periodsFailed')}</p>
                    <Button className="mt-3" variant="ghost" onClick={() => void periodsQuery.refetch()}>{t('common.retry')}</Button>
                  </div>
                )}
                {periodsQuery.data?.length === 0 && <p className="rounded-lg border border-white/8 p-4 text-sm text-text-muted">{t('budget.noPeriods')}</p>}
                {periodsQuery.data?.map((period) => {
                  const periodStatus = periodStatusMeta[period.status]
                  const periodFrequency = period.frequency ?? selected.frequency
                  const periodScope = period.scope ?? selected.scope
                  const fallbackCategoryId = period.categoryId ?? (period.scope === undefined ? selected.categoryId : undefined)
                  const periodCategory = fallbackCategoryId ? categories.find((category) => category.id === fallbackCategoryId) : undefined
                  const periodCategoryName = period.categoryName
                    ?? (periodCategory ? categoryLabel(periodCategory, td) : undefined)
                    ?? (period.scope === undefined ? selected.categoryName : undefined)
                  const periodScopeLabel = periodScope === 'global'
                    ? t('budget.global')
                    : `${t('budget.byCategory')}${periodCategoryName ? ` · ${periodCategoryName}` : ''}`
                  return (
                    <article key={period.id} className="grid gap-3 rounded-lg border border-white/8 bg-white/[0.025] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong className="block text-sm text-text-glow">{formatDate(period.startsAt, undefined, period.timezone)} — {formatDate(period.endsAt, undefined, period.timezone)}</strong>
                          <span className="block font-mono text-[10px] text-text-muted">{period.timezone}</span>
                          <span className="mt-1 block font-mono text-[10px] text-tertiary">
                            {periodFrequency === 'weekly' ? t('budget.weekly') : t('budget.monthly')} · {periodScopeLabel}
                          </span>
                        </div>
                        <Badge tone={periodStatus.tone}>{t(periodStatus.labelKey)}</Badge>
                      </div>
                      <BudgetGauge compact spendMinor={period.spendMinor} limitMinor={period.limitMinor} currency={period.currency} />
                      <div className="grid grid-cols-2 gap-3 font-mono text-[10px] sm:grid-cols-4">
                        <div><span className="block text-text-muted">{t('budget.surplus')}</span><strong className="mt-1 block text-text-glow">{formatMoney(period.surplusMinor, period.currency)}</strong></div>
                        <div><span className="block text-text-muted">{t('budget.eligibleLabel')}</span><strong className="mt-1 block text-neon-cyan">{formatMoney(period.eligibleSurplusMinor, period.currency)}</strong></div>
                        {period.status === 'met' ? (
                          <div className="col-span-2"><span className="block text-text-muted">{t('budget.reward')}</span><strong className="mt-1 block text-success">+{period.synthcoinsAwarded} SC · +{period.fluxAwarded} Flux</strong></div>
                        ) : period.status === 'exceeded' ? (
                          <div className="col-span-2"><span className="block text-text-muted">{t('budget.damage')}</span><strong className="mt-1 block text-neon-magenta">{period.baseDamage} · {(period.excessPercentBp / 100).toFixed(2)}%</strong></div>
                        ) : (
                          <div className="col-span-2 text-text-muted">{t('budget.pendingEvaluation')}</div>
                        )}
                      </div>
                      {period.excludedRewardMinor > 0 && <p className="text-xs text-text-muted">{t('budget.excludedAmount', { amount: formatMoney(period.excludedRewardMinor, period.currency) })}</p>}
                    </article>
                  )
                })}
              </section>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTargetId(null)}
        title={t('budget.archiveTitle')}
        description={archiveTarget ? t('budget.archiveQuestion', { name: archiveTarget.name }) : undefined}
        centered
      >
        <div className="grid gap-5">
          <p className="rounded-lg border border-sunset/25 bg-sunset/5 p-4 text-sm leading-6 text-sunset">{t('budget.archiveNote')}</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setArchiveTargetId(null)}>{t('common.cancel')}</Button>
            <Button variant="magenta" icon={Archive} loading={busyAction === 'archive'} onClick={() => void confirmArchive()}>{t('budget.archive')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
