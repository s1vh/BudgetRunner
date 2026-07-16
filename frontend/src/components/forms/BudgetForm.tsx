import { useState, type FormEvent } from 'react'
import { Radar } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui/primitives'
import type { BudgetDraft, BudgetFrequency, BudgetScope, Category } from '@/types/domain'

export function BudgetForm({ categories, onSubmit, onCancel }: { categories: Category[]; onSubmit: (draft: BudgetDraft) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<BudgetFrequency>('monthly')
  const [scope, setScope] = useState<BudgetScope>('global')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [limit, setLimit] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedLimit = Number(limit.replace(',', '.'))
    const nextErrors: Record<string, string> = {}
    if (name.trim().length < 3) nextErrors.name = 'Escribe un nombre de al menos 3 caracteres.'
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) nextErrors.limit = 'El límite debe ser mayor que cero.'
    if (scope === 'category' && !categoryId) nextErrors.categoryId = 'Selecciona una categoría.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), frequency, scope, categoryId: scope === 'category' ? categoryId : undefined, limitMinor: Math.round(parsedLimit * 100), currency, startsOn })
    } finally { setSubmitting(false) }
  }

  return (
    <form className="grid gap-5" onSubmit={submit} noValidate>
      <Field label="Nombre del presupuesto" htmlFor="budget-name" error={errors.name} required><Input id="budget-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Ocio Holográfico" aria-invalid={Boolean(errors.name)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Periodicidad" htmlFor="budget-frequency" required><Select id="budget-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as BudgetFrequency)}><option value="weekly">Semanal</option><option value="monthly">Mensual</option></Select></Field>
        <Field label="Alcance" htmlFor="budget-scope" required><Select id="budget-scope" value={scope} onChange={(event) => setScope(event.target.value as BudgetScope)}><option value="global">Global</option><option value="category">Por categoría</option></Select></Field>
      </div>
      {scope === 'category' && <Field label="Categoría" htmlFor="budget-category" error={errors.categoryId} required><Select id="budget-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.filter((category) => category.id !== 'cat-income').map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>}
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Límite" htmlFor="budget-limit" error={errors.limit} required><Input id="budget-limit" inputMode="decimal" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="0,00" aria-invalid={Boolean(errors.limit)} /></Field>
        <Field label="Moneda" htmlFor="budget-currency" required><Select id="budget-currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option>EUR</option><option>USD</option><option>GBP</option></Select></Field>
      </div>
      <Field label="Comienza el" htmlFor="budget-start" hint="La zona horaria se fijará al crear el periodo." required><Input id="budget-start" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></Field>
      <div className="rounded-lg border border-tertiary/20 bg-tertiary/5 p-3 text-xs leading-5 text-text-muted">Los solapamientos están permitidos. La futura API aplicará el orden de atribución documentado para evitar recompensas duplicadas.</div>
      <div className="flex flex-col-reverse gap-3 border-t border-outline-soft/60 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button type="submit" icon={Radar} loading={submitting}>Activar presupuesto</Button></div>
    </form>
  )
}
