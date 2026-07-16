import { useMemo, useState } from 'react'
import { Edit3, Filter, LockKeyhole, Plus, Search, Trash2, WalletCards } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { TransactionForm } from '@/components/forms/TransactionForm'
import { Badge, Button, Input, Modal, PageSkeleton, Select, SynthCard } from '@/components/ui/primitives'
import { PageHeader } from '@/components/ui/PageHeader'
import type { FinancialTransaction, TransactionDraft } from '@/types/domain'
import { formatDate, formatMoney } from '@/utils/format'

export function TransactionsPage() {
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
      const matchesQuery = transaction.concept.toLowerCase().includes(query.toLowerCase()) || transaction.categoryName.toLowerCase().includes(query.toLowerCase())
      return matchesQuery && (type === 'all' || transaction.type === type) && (category === 'all' || transaction.categoryId === category) && (status === 'all' || transaction.status === status)
    })
  }, [category, data, query, status, type])

  if (loading || !data) return <PageSkeleton />
  const expenses = filtered.filter((item) => item.type === 'expense' && item.status === 'posted').reduce((sum, item) => sum + item.amountMinor, 0)
  const income = filtered.filter((item) => item.type === 'income' && item.status === 'posted').reduce((sum, item) => sum + item.amountMinor, 0)

  async function save(draft: TransactionDraft) {
    if (editing && editing !== 'new') await updateTransaction(editing.id, draft)
    else await createTransaction(draft)
    setEditing(null)
    setFeedback(editing === 'new' ? 'Operación registrada en la memoria local.' : 'Operación actualizada.')
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await deleteTransaction(deleting)
      setFeedback('Operación eliminada.')
      setDeleting(null)
    } catch {
      setFeedback(deleting.lockedByReward ? 'Operación protegida por recompensa: crea un ajuste compensatorio.' : 'No se pudo eliminar la operación.')
      setDeleting(null)
    } finally { setDeletingBusy(false) }
  }

  return (
    <div className="page-enter grid gap-6">
      <PageHeader eyebrow="Ledger financiero" title="Gastos e ingresos" description="Consulta, filtra y registra operaciones. Las cantidades se preparan como unidades menores para el futuro contrato REST." icon={WalletCards} actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nueva operación</Button>} />
      {feedback && <button type="button" onClick={() => setFeedback(null)} className="flex items-center justify-between rounded-lg border border-neon-cyan/25 bg-neon-cyan/5 p-3 text-left text-sm text-neon-cyan"><span>{feedback}</span><span className="font-mono text-[10px]">CERRAR</span></button>}

      <div className="grid gap-4 sm:grid-cols-3">
        <SynthCard className="p-4" tone="magenta"><p className="font-mono text-[10px] text-text-muted uppercase">Gasto filtrado</p><strong className="mt-2 block font-display text-xl text-neon-magenta tabular">{formatMoney(expenses, 'EUR')}</strong></SynthCard>
        <SynthCard className="p-4" tone="cyan"><p className="font-mono text-[10px] text-text-muted uppercase">Ingreso filtrado</p><strong className="mt-2 block font-display text-xl text-neon-cyan tabular">{formatMoney(income, 'EUR')}</strong></SynthCard>
        <SynthCard className="p-4" tone="purple"><p className="font-mono text-[10px] text-text-muted uppercase">Balance visible</p><strong className="mt-2 block font-display text-xl text-tertiary tabular">{formatMoney(income - expenses, 'EUR')}</strong></SynthCard>
      </div>

      <SynthCard className="p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(150px,auto))]">
          <label className="relative"><span className="sr-only">Buscar</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar concepto o categoría…" /></label>
          <Select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtrar por tipo"><option value="all">Todos los tipos</option><option value="expense">Gastos</option><option value="income">Ingresos</option></Select>
          <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoría"><option value="all">Todas las categorías</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por estado"><option value="all">Todos los estados</option><option value="posted">Contabilizadas</option><option value="scheduled">Programadas</option></Select>
        </div>
      </SynthCard>

      <SynthCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-soft/60 px-4 py-3 sm:px-5"><span className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-text-muted uppercase"><Filter className="size-4" />{filtered.length} transmisiones</span><span className="font-mono text-[10px] text-tertiary">Página 1 / 1</span></div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Concepto</th><th>Categoría</th><th>Fecha</th><th>Estado</th><th>Importe</th><th><span className="sr-only">Acciones</span></th></tr></thead>
            <tbody>
              {filtered.map((transaction) => (
                <tr key={transaction.id}>
                  <td data-label="Concepto"><div><strong className="text-sm">{transaction.concept}</strong>{transaction.lockedByReward && <span className="ml-2 inline-flex items-center gap-1 font-mono text-[9px] text-sunset"><LockKeyhole className="size-3" />LOCK</span>}</div></td>
                  <td data-label="Categoría"><span className="text-sm text-text-muted">{transaction.categoryName}</span></td>
                  <td data-label="Fecha"><span className="font-mono text-xs text-text-muted">{formatDate(transaction.occurredAt)}</span></td>
                  <td data-label="Estado"><Badge tone={transaction.status === 'posted' ? 'success' : 'purple'}>{transaction.status === 'posted' ? 'Contabilizada' : 'Programada'}</Badge></td>
                  <td data-label="Importe"><span className={`font-mono text-sm font-bold tabular ${transaction.type === 'income' ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amountMinor, transaction.currency)}</span></td>
                  <td data-label="Acciones"><div className="flex justify-end gap-1"><button type="button" disabled={transaction.lockedByReward} onClick={() => setEditing(transaction)} className="grid size-10 place-items-center rounded-lg text-text-muted transition hover:bg-neon-cyan/8 hover:text-neon-cyan disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Editar ${transaction.concept}`}><Edit3 className="size-4" /></button><button type="button" onClick={() => setDeleting(transaction)} className="grid size-10 place-items-center rounded-lg text-text-muted transition hover:bg-neon-magenta/8 hover:text-neon-magenta" aria-label={`Eliminar ${transaction.concept}`}><Trash2 className="size-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="p-10 text-center text-sm text-text-muted">No hay operaciones que coincidan con los filtros.</p>}
        </div>
      </SynthCard>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva operación' : 'Editar operación'} description="El mismo formulario se utiliza para alta y edición.">
        {editing && <TransactionForm key={editing === 'new' ? 'new' : editing.id} categories={data.categories} initial={editing === 'new' ? undefined : editing} onSubmit={save} onCancel={() => setEditing(null)} />}
      </Modal>
      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Confirmar eliminación" description={deleting?.lockedByReward ? 'Esta operación está protegida. El backend responderá 409 y se ofrecerá un ajuste compensatorio.' : 'Esta acción retirará la operación de la sesión mock.'}>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button><Button variant="magenta" icon={Trash2} loading={deletingBusy} onClick={() => void confirmDelete()}>Eliminar</Button></div>
      </Modal>
    </div>
  )
}
