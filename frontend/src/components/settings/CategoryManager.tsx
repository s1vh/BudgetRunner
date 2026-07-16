import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Save, Tags, Trash2, X } from 'lucide-react'
import { useAppData } from '@/app/AppDataContext'
import { Button, Field, Input, Select, SynthCard } from '@/components/ui/primitives'
import type { Category, CategoryDraft } from '@/types/domain'

const iconOptions = [
  ['shapes', 'Formas'],
  ['utensils', 'Alimentación'],
  ['car', 'Transporte'],
  ['building', 'Vivienda'],
  ['cpu', 'Tecnología'],
  ['gamepad', 'Ocio'],
  ['heart-pulse', 'Salud'],
  ['radio', 'Suscripciones'],
  ['wrench', 'Mantenimiento'],
] as const

const emptyDraft: CategoryDraft = { name: '', icon: 'shapes', color: '#00FFFF' }

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'No se ha podido completar la operación.'
}

export function CategoryManager() {
  const { data, createCategory, updateCategory, deleteCategory } = useAppData()
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!data) return null

  function openCreate() {
    setDraft(emptyDraft)
    setEditingId(null)
    setDeleteId(null)
    setError(null)
    setNotice(null)
    setEditorOpen(true)
  }

  function openEdit(category: Category) {
    setDraft({ name: category.name, icon: category.icon, color: category.color })
    setEditingId(category.id)
    setDeleteId(null)
    setError(null)
    setNotice(null)
    setEditorOpen(true)
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditingId(null)
    setDraft(emptyDraft)
    setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const input: CategoryDraft = {
      name: String(form.get('name') ?? '').trim(),
      icon: String(form.get('icon') ?? 'shapes'),
      color: String(form.get('color') ?? '#986780').toUpperCase(),
    }
    if (input.name.length < 2) {
      setError('El nombre debe contener al menos 2 caracteres.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (editingId) {
        await updateCategory(editingId, input)
        setNotice(`Categoría «${input.name}» actualizada.`)
      } else {
        await createCategory(input)
        setNotice(`Categoría «${input.name}» creada.`)
      }
      setEditorOpen(false)
      setEditingId(null)
      setDraft(emptyDraft)
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(category: Category) {
    setBusy(true)
    setError(null)
    try {
      await deleteCategory(category.id)
      setDeleteId(null)
      if (editingId === category.id) closeEditor()
      setNotice(`Categoría «${category.name}» eliminada de las categorías activas.`)
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SynthCard className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tags className="size-4 text-tertiary" />
          <h2 className="font-display text-sm font-bold uppercase">Categorías</h2>
        </div>
        <Button type="button" variant="ghost" className="min-h-9 px-3 text-[10px]" icon={Plus} onClick={openCreate} disabled={busy}>
          Añadir
        </Button>
      </div>

      {editorOpen && (
        <form className="mb-4 grid gap-4 rounded-lg border border-neon-cyan/20 bg-neon-cyan/[0.035] p-4" onSubmit={(event) => void submit(event)}>
          <div className="flex items-center justify-between gap-3">
            <strong className="font-display text-xs uppercase tracking-[0.08em] text-neon-cyan">
              {editingId ? 'Editar categoría' : 'Nueva categoría'}
            </strong>
            <button type="button" className="rounded p-1 text-text-muted transition hover:bg-white/5 hover:text-white" onClick={closeEditor} aria-label="Cerrar editor">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_5rem]">
            <Field label="Nombre" htmlFor="category-name" required>
              <Input id="category-name" name="name" value={draft.name} maxLength={80} autoFocus onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Viajes estelares" />
            </Field>
            <Field label="Icono" htmlFor="category-icon">
              <Select id="category-icon" name="icon" value={draft.icon} onChange={(event) => setDraft((current) => ({ ...current, icon: event.target.value }))}>
                {iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Color" htmlFor="category-color">
              <Input id="category-color" name="color" type="color" className="min-h-11 cursor-pointer p-1" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value.toUpperCase() }))} />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeEditor} disabled={busy}>Cancelar</Button>
            <Button type="submit" icon={Save} loading={busy}>{editingId ? 'Guardar' : 'Crear categoría'}</Button>
          </div>
        </form>
      )}

      <div aria-live="polite">
        {error && <p className="mb-3 rounded-lg border border-neon-magenta/25 bg-neon-magenta/5 p-3 text-xs text-neon-magenta">{error}</p>}
        {notice && <p className="mb-3 rounded-lg border border-success/25 bg-success/5 p-3 text-xs text-success">{notice}</p>}
      </div>

      <div className="grid gap-2">
        {data.categories.map((category) => (
          <div key={category.id} className="rounded-lg border border-white/7 bg-white/[0.025] p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <i className="size-2.5 shrink-0 rounded-full" style={{ background: category.color, boxShadow: `0 0 8px ${category.color}` }} />
                <span className="truncate text-sm">{category.name}</span>
              </span>
              <span className="flex items-center gap-1">
                <Button type="button" variant="ghost" className="min-h-8 px-2 text-[10px]" icon={Pencil} onClick={() => openEdit(category)} disabled={busy}>Editar</Button>
                <Button type="button" variant="ghost" className="min-h-8 px-2 text-[10px] text-neon-magenta" icon={Trash2} onClick={() => setDeleteId(category.id)} disabled={busy}>Borrar</Button>
              </span>
            </div>
            {deleteId === category.id && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-neon-magenta/15 pt-3">
                <p className="text-xs text-text-muted">Si ya tiene gastos, se archivará para conservar su historial.</p>
                <span className="flex gap-2">
                  <Button type="button" variant="ghost" className="min-h-8 px-3 text-[10px]" onClick={() => setDeleteId(null)} disabled={busy}>Cancelar</Button>
                  <Button type="button" variant="magenta" className="min-h-8 px-3 text-[10px]" loading={busy} onClick={() => void remove(category)}>Confirmar borrado</Button>
                </span>
              </div>
            )}
          </div>
        ))}
        {data.categories.length === 0 && <p className="rounded-lg border border-dashed border-outline-soft p-4 text-center text-xs text-text-muted">No hay categorías activas. Crea una para registrar nuevas operaciones.</p>}
      </div>
    </SynthCard>
  )
}
