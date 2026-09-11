import { useState, type FormEvent } from 'react'
import { Radar } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui/primitives'
import type { Budget, BudgetDraft, BudgetFrequency, BudgetScope, Category } from '@/types/domain'
import { useI18n } from '@/i18n/I18nContext'
import { categoryLabel } from '@/i18n/categoryLabel'

function todayForDateInput(timeZone?: string) {
  const now = new Date()
  if (!timeZone) return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

interface BudgetFormProps {
  categories: Category[]
  initial?: Budget
  defaultCurrency?: string
  defaultTimezone?: string
  onSubmit: (draft: BudgetDraft) => Promise<void>
  onCancel: () => void
}

export function BudgetForm({ categories, initial, defaultCurrency = 'EUR', defaultTimezone, onSubmit, onCancel }: BudgetFormProps) {
  const { t, td } = useI18n()
  const availableCategories = categories.filter((category) => category.id !== 'cat-income')
  const configuredScope = initial?.configuredScope ?? initial?.scope ?? 'global'
  const configuredCategoryId = initial?.configuredCategoryId ?? initial?.categoryId
  const [name, setName] = useState(initial?.name ?? '')
  const [frequency, setFrequency] = useState<BudgetFrequency>(initial?.configuredFrequency ?? initial?.frequency ?? 'monthly')
  const [scope, setScope] = useState<BudgetScope>(configuredScope)
  const [categoryId, setCategoryId] = useState(configuredCategoryId ?? availableCategories[0]?.id ?? '')
  const [limit, setLimit] = useState(initial ? String((initial.configuredLimitMinor ?? initial.limitMinor) / 100) : '')
  const [currency, setCurrency] = useState(initial?.configuredCurrency ?? initial?.currency ?? defaultCurrency)
  const [startsOn, setStartsOn] = useState(initial?.startsAt.slice(0, 10) ?? todayForDateInput(defaultTimezone))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedLimit = Number(limit.replace(',', '.'))
    const nextErrors: Record<string, string> = {}
    if (name.trim().length < 3) nextErrors.name = t('budget.nameError')
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) nextErrors.limit = t('budget.limitError')
    if (scope === 'category' && !categoryId) nextErrors.categoryId = t('form.selectCategory')
    if (!initial && !startsOn) nextErrors.startsOn = t('budget.startError')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit({ name: name.trim(), frequency, scope, categoryId: scope === 'category' ? categoryId : undefined, limitMinor: Math.round(parsedLimit * 100), currency, startsOn })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t('budget.saveFailed'))
    } finally { setSubmitting(false) }
  }

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <Field label={t('budget.name')} htmlFor="budget-name" error={errors.name} required><Input id="budget-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('budget.nameExample')} aria-invalid={Boolean(errors.name)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('budget.periodicity')} htmlFor="budget-frequency" required><Select id="budget-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as BudgetFrequency)}><option value="weekly">{t('budget.weekly')}</option><option value="monthly">{t('budget.monthly')}</option></Select></Field>
        <Field label={t('budget.scope')} htmlFor="budget-scope" required><Select id="budget-scope" value={scope} onChange={(event) => { const nextScope = event.target.value as BudgetScope; setScope(nextScope); if (nextScope === 'category' && !categoryId) setCategoryId(availableCategories[0]?.id ?? '') }}><option value="global">{t('budget.global')}</option><option value="category">{t('budget.byCategory')}</option></Select></Field>
      </div>
      {scope === 'category' && <Field label={t('transactions.category')} htmlFor="budget-category" error={errors.categoryId} required><Select id="budget-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{availableCategories.map((category) => <option key={category.id} value={category.id}>{categoryLabel(category, td)}</option>)}</Select></Field>}
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label={t('budget.limit')} htmlFor="budget-limit" error={errors.limit} required><Input id="budget-limit" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.limit)} /></Field>
        <Field label={t('auth.currency')} htmlFor="budget-currency" required><Select id="budget-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></Select></Field>
      </div>
      {!initial && <Field label={t('budget.startsOn')} htmlFor="budget-start" hint={t('budget.timezoneHint')} error={errors.startsOn} required><Input id="budget-start" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} aria-invalid={Boolean(errors.startsOn)} /></Field>}
      <div className="rounded-lg border border-tertiary/20 bg-tertiary/5 p-3 text-xs leading-5 text-text-muted">{initial ? t('budget.changesNextPeriod') : t('budget.overlapNote')}</div>
      {submitError && <p className="rounded-lg border border-neon-magenta/25 bg-neon-magenta/5 p-3 text-sm text-neon-magenta" role="alert">{submitError}</p>}
      <div className="flex flex-col-reverse gap-3 border-t border-outline-soft/60 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" icon={Radar} loading={submitting}>{initial ? t('common.save') : t('budget.activate')}</Button></div>
    </form>
  )
}
