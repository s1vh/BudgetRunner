import { useMemo, useState } from 'react'
import { Edit3, Filter, LockKeyhole, Plus, Search, Trash2, WalletCards } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { Badge, Button, Input, Modal, PageSkeleton, Select, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import type { FinancialTransaction, TransactionDraft } from '@/types/domain'
import { formatDate, formatMoney } from '@/utils/format'
import { useI18n } from '@/i18n/I18nContext'
import { categoryLabel } from '@/i18n/categoryLabel'

export function TransactionsPage() {
  const { t, td } = useI18n()
  const { data, loading, createTransaction, updateTransaction, deleteTransaction } = useAppData()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState<FinancialTransaction | null | 'new'>(null)
  const [deleting, setDeleting] = useState<FinancialTransaction | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!data) return []
    return data.transactions.filter((transaction) => {
      const matchedCategory = data.categories.find((item) => item.id === transaction.categoryId)
      const localizedCategory = matchedCategory ? categoryLabel(matchedCategory, td) : transaction.categoryName
      const normalizedQuery = query.toLocaleLowerCase()
      const matchesQuery = transaction.concept.toLocaleLowerCase().includes(normalizedQuery)
        || transaction.categoryName.toLocaleLowerCase().includes(normalizedQuery)
        || localizedCategory.toLocaleLowerCase().includes(normalizedQuery)
      return matchesQuery && (type === 'all' || transaction.type === type) && (category === 'all' || transaction.categoryId === category) && (status === 'all' || transaction.status === status)
    })
  }, [category, data, query, status, td, type])

  if (loading || !data) return <PageSkeleton />
  const expenses = filtered.filter((item) => item.type === 'expense' && item.status === 'posted').reduce((sum, item) => sum + item.amountMinor, 0)
  const income = filtered.filter((item) => item.type === 'income' && item.status === 'posted').reduce((sum, item) => sum + item.amountMinor, 0)

  async function save(draft: TransactionDraft) {
    if (editing && editing !== 'new') await updateTransaction(editing.id, draft)
    else await createTransaction(draft)
    setEditing(null)
    setFeedback(editing === 'new' ? t('transactions.created') : t('transactions.updated'))
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deleteTransaction(deleting)
      setFeedback(t('transactions.deleted'))
      setDeleting(null)
    } catch {
      setFeedback(deleting.lockedByReward ? t('transactions.rewardLocked') : t('transactions.deleteFailed'))
      setDeleting(null)
    } finally { setDeletingBusy(false) }
  }

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow={t('transactions.eyebrow')} title={t('transactions.title')} description={t('transactions.description')} icon={WalletCards} tourId="transactions-header" actions={<Button icon={Plus} onClick={() => setEditing('new')}>{t('transactions.new')}</Button>} />
      {feedback && <button type="button" onClick={() => setFeedback(null)} className="flex items-center justify-between rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3 text-left text-sm text-neon-cyan"><span>{feedback}</span><span className="font-mono text-[10px]">{t('common.close')}</span></button>}

      <div className="grid gap-4 sm:grid-cols-3" data-tour="transactions-summary">
        <SynthCard className="p-4 pr-14" tone="magenta" helpKey="help.transactions.expense"><p className="font-mono text-[10px] text-text-muted uppercase">{t('transactions.filteredExpense')}</p><strong className="mt-2 block font-display text-xl text-neon-magenta tabular">{formatMoney(expenses, data.profile.primaryCurrency)}</strong></SynthCard>
        <SynthCard className="p-4 pr-14" tone="cyan" helpKey="help.transactions.income"><p className="font-mono text-[10px] text-text-muted uppercase">{t('transactions.filteredIncome')}</p><strong className="mt-2 block font-display text-xl text-neon-cyan tabular">{formatMoney(income, data.profile.primaryCurrency)}</strong></SynthCard>
        <SynthCard className="p-4 pr-14" tone="purple" helpKey="help.transactions.balance"><p className="font-mono text-[10px] text-text-muted uppercase">{t('transactions.visibleBalance')}</p><strong className="mt-2 block font-display text-xl text-tertiary tabular">{formatMoney(income - expenses, data.profile.primaryCurrency)}</strong></SynthCard>
      </div>

      <SynthCard className="p-4 pr-14 sm:p-5 sm:pr-16" helpKey="help.transactions.filters" data-tour="transactions-filters">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(150px,auto))]">
          <label className="relative"><span className="sr-only">{t('transactions.search')}</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('transactions.search')} /></label>
          <Select value={type} onChange={(event) => setType(event.target.value)} aria-label={t('transactions.filterType')}><option value="all">{t('transactions.allTypes')}</option><option value="expense">{t('chart.expenses')}</option><option value="income">{t('chart.income')}</option></Select>
          <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label={t('transactions.filterCategory')}><option value="all">{t('transactions.allCategories')}</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{categoryLabel(item, td)}</option>)}</Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t('transactions.filterStatus')}><option value="all">{t('transactions.allStatuses')}</option><option value="posted">{t('transactions.posted')}</option><option value="scheduled">{t('transactions.scheduled')}</option></Select>
        </div>
      </SynthCard>

      <SynthCard className="overflow-hidden" helpKey="help.transactions.list" data-tour="transactions-list">
        <div className="flex items-center justify-between border-b border-outline-soft/60 py-3 pl-4 pr-14 sm:pl-5 sm:pr-16"><span className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-text-muted uppercase"><Filter className="size-4" />{t('transactions.count', { count: filtered.length })}</span><span className="font-mono text-[10px] text-tertiary">{t('transactions.page')}</span></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>{t('transactions.concept')}</th><th>{t('transactions.category')}</th><th>{t('transactions.date')}</th><th>{t('transactions.status')}</th><th>{t('transactions.amount')}</th><th><span className="sr-only">{t('transactions.actions')}</span></th></tr></thead>
            <tbody>
              {filtered.map((transaction) => (
                <tr key={transaction.id}>
                  <td data-label={t('transactions.concept')}><div><strong className="text-sm">{transaction.concept}</strong>{transaction.lockedByReward && <span className="ml-2 inline-flex items-center gap-1 font-mono text-[9px] text-sunset"><LockKeyhole className="size-3" />{t('transactions.lockShort')}</span>}</div></td>
                  <td data-label={t('transactions.category')}><span className="text-sm text-text-muted">{categoryLabel(data.categories.find((item) => item.id === transaction.categoryId) ?? { name: transaction.categoryName }, td)}</span></td>
                  <td data-label={t('transactions.date')}><span className="font-mono text-xs text-text-muted">{formatDate(transaction.occurredAt)}</span></td>
                  <td data-label={t('transactions.status')}><Badge tone={transaction.status === 'posted' ? 'success' : 'purple'}>{transaction.status === 'posted' ? t('transactions.posted') : t('transactions.scheduled')}</Badge></td>
                  <td data-label={t('transactions.amount')}><span className={`font-mono text-sm font-bold tabular ${transaction.type === 'income' ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amountMinor, transaction.currency)}</span></td>
                  <td data-label={t('transactions.actions')}><div className="flex justify-end gap-1"><button type="button" disabled={transaction.lockedByReward} onClick={() => setEditing(transaction)} className="grid size-10 place-items-center rounded-lg text-text-muted transition hover:bg-neon-cyan/8 hover:text-neon-cyan disabled:cursor-not-allowed disabled:opacity-30" aria-label={`${t('common.edit')} ${transaction.concept}`}><Edit3 className="size-4" /></button><button type="button" onClick={() => setDeleting(transaction)} className="grid size-10 place-items-center rounded-lg text-text-muted transition hover:bg-neon-magenta/8 hover:text-neon-magenta" aria-label={`${t('common.delete')} ${transaction.concept}`}><Trash2 className="size-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-10 text-center text-sm text-text-muted">{t('transactions.empty')}</p>}
        </div>
      </SynthCard>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? t('transactions.new') : t('transactions.editTitle')} description={t('transactions.editDescription')}>
        {editing && <TransactionForm key={editing === 'new' ? 'new' : editing.id} categories={data.categories} initial={editing === 'new' ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />}
      </Modal>
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={t('transactions.deleteTitle')} description={deleting ? t('transactions.deleteQuestion', { name: deleting.concept }) : undefined}>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button><Button variant="magenta" icon={Trash2} loading={deletingBusy} onClick={() => void confirmDelete()}>{t('common.delete')}</Button></div>
      </Modal>
    </div>
  )
}
