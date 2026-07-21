import { useMemo, useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives'
import type { Category, FinancialTransaction, TransactionDraft, TransactionStatus, TransactionType } from '@/types/domain'
import { useI18n } from '@/i18n/I18nContext'
import { categoryLabel } from '@/i18n/categoryLabel'

interface TransactionFormProps {
  categories: Category[]
  initial?: FinancialTransaction
  onSubmit: (draft: TransactionDraft) => Promise<void>
  onCancel: () => void
}

export function TransactionForm({ categories, initial, onSubmit, onCancel }: TransactionFormProps) {
  const { t, td } = useI18n()
  const initialDate = useMemo(() => initial?.occurredAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10), [initial])
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'expense')
  const [concept, setConcept] = useState(initial?.concept ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amountMinor / 100) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? '')
  const [occurredAt, setOccurredAt] = useState(initialDate)
  const [status, setStatus] = useState<TransactionStatus>(initial?.status ?? 'posted')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    const numericAmount = Number(amount.replace(',', '.'))
    if (concept.trim().length < 2) nextErrors.concept = t('form.conceptError')
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) nextErrors.amount = t('form.amountError')
    if (!categoryId) nextErrors.categoryId = t('form.selectCategory')
    if (!occurredAt) nextErrors.occurredAt = t('form.selectDate')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await onSubmit({
        type,
        concept: concept.trim(),
        amountMinor: Math.round(numericAmount * 100),
        currency,
        categoryId,
        occurredAt: occurredAt === today ? new Date().toISOString() : new Date(`${occurredAt}T12:00:00Z`).toISOString(),
        notes: notes.trim() || undefined,
        status,
      })
    } catch (error) {
      setErrors((current) => ({ ...current, form: error instanceof Error ? error.message : t('form.transactionFailed') }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      {errors.form && <div role="alert" className="rounded-lg border border-neon-magenta/30 bg-neon-magenta/7 p-3 text-sm text-neon-magenta">{errors.form}</div>}
      {initial?.lockedByReward && <div className="rounded-lg border border-sunset/30 bg-sunset/7 p-3 text-sm text-sunset">{t('form.rewardWarning')}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.type')} htmlFor="transaction-type" required>
          <Select id="transaction-type" value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
            <option value="expense">{t('transactions.expense')}</option><option value="income">{t('transactions.income')}</option>
          </Select>
        </Field>
        <Field label={t('transactions.status')} htmlFor="transaction-status" required>
          <Select id="transaction-status" value={status} onChange={(event) => setStatus(event.target.value as TransactionStatus)}>
            <option value="posted">{t('transactions.posted')}</option><option value="scheduled">{t('transactions.scheduled')}</option>
          </Select>
        </Field>
      </div>
      <Field label={t('transactions.concept')} htmlFor="transaction-concept" error={errors.concept} required>
        <Input id="transaction-concept" value={concept} onChange={(event) => setConcept(event.target.value)} placeholder={t('form.exampleConcept')} maxLength={160} aria-invalid={Boolean(errors.concept)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label={t('transactions.amount')} htmlFor="transaction-amount" error={errors.amount} hint={t('form.minorUnitsHint')} required>
          <Input id="transaction-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" aria-invalid={Boolean(errors.amount)} />
        </Field>
        <Field label={t('auth.currency')} htmlFor="transaction-currency" required>
          <Select id="transaction-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('transactions.category')} htmlFor="transaction-category" error={errors.categoryId} required>
          <Select id="transaction-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-invalid={Boolean(errors.categoryId)}>
            {categories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, td)}</option>)}
          </Select>
        </Field>
        <Field label={t('transactions.date')} htmlFor="transaction-date" error={errors.occurredAt} required>
          <Input id="transaction-date" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} aria-invalid={Boolean(errors.occurredAt)} />
        </Field>
      </div>
      <Field label={t('form.notes')} htmlFor="transaction-notes" hint={t('form.notesHint')}>
        <Textarea id="transaction-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('form.notesPlaceholder')} />
      </Field>
      <div className="flex flex-col-reverse gap-3 border-t border-outline-soft/60 pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" icon={Save} loading={submitting}>{initial ? t('form.saveChanges') : t('form.recordTransaction')}</Button>
      </div>
    </form>
  )
}
