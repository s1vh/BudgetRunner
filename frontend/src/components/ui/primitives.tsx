/* eslint-disable react-refresh/only-export-components -- this module is the shared UI barrel */
import { X, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { useI18n } from '@/i18n/I18nContext'

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

type CardTone = 'default' | 'cyan' | 'magenta' | 'purple' | 'danger'

interface SynthCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone
  interactive?: boolean
}

export function SynthCard({ className, tone = 'default', interactive, ...props }: SynthCardProps) {
  return <div className={cn('synth-card', tone !== 'default' && `synth-card--${tone}`, interactive && 'synth-card--interactive', className)} {...props} />
}

type ButtonVariant = 'cyan' | 'magenta' | 'purple' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  icon?: LucideIcon
  loading?: boolean
}

export function Button({ className, variant = 'cyan', icon: Icon, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button className={cn('neon-button', `neon-button--${variant}`, className)} disabled={disabled || loading} {...props}>
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

type BadgeTone = 'cyan' | 'magenta' | 'purple' | 'success' | 'warning' | 'muted'
const badgeTones: Record<BadgeTone, string> = {
  cyan: 'border-neon-cyan/35 bg-neon-cyan/8 text-neon-cyan',
  magenta: 'border-neon-magenta/35 bg-neon-magenta/8 text-neon-magenta',
  purple: 'border-tertiary/35 bg-tertiary/8 text-tertiary',
  success: 'border-success/35 bg-success/8 text-success',
  warning: 'border-sunset/35 bg-sunset/8 text-sunset',
  muted: 'border-white/10 bg-white/4 text-text-muted',
}

export function Badge({ tone = 'muted', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex min-h-6 items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] font-bold tracking-[0.08em] uppercase', badgeTones[tone], className)}>{children}</span>
}

interface FieldProps {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="font-mono text-xs font-bold tracking-[0.07em] text-text-muted uppercase">
        {label}{required && <span className="ml-1 text-neon-magenta" aria-hidden="true">*</span>}
      </label>
      {children}
      {error ? <p id={`${htmlFor}-error`} className="text-xs text-[#ff8ea0]">{error}</p> : hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('form-control', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('form-control', className)} {...props}>{children}</select>
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('form-control', className)} {...props} />
}

interface ProgressProps {
  value: number
  max?: number
  tone?: 'cyan' | 'magenta' | 'purple' | 'warning'
  label?: string
}

export function Progress({ value, max = 100, tone = 'cyan', label }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="grid gap-1.5">
      {label && <div className="flex justify-between font-mono text-[11px] text-text-muted"><span>{label}</span><span>{Math.round(percentage)}%</span></div>}
      <div className="progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className={cn('progress-fill', `progress-fill--${tone}`)} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <SynthCard className="dialog-panel p-5 sm:p-7" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-neon-cyan uppercase">{t('common.secureTerminal')}</p>
            <h2 id="dialog-title" className="font-display text-xl font-bold text-text-glow sm:text-2xl">{title}</h2>
            {description && <p className="mt-2 max-w-xl text-sm text-text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-lg border border-white/10 text-text-muted transition hover:border-neon-magenta/40 hover:text-neon-magenta" aria-label={t('common.closeDialog')}><X className="size-5" /></button>
        </div>
        {children}
      </SynthCard>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />
}

export function PageSkeleton() {
  return <div className="grid gap-6"><Skeleton className="h-24" /><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div><Skeleton className="h-80" /></div>
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="grid min-h-56 place-items-center px-4 py-10 text-center"><div><div className="mx-auto mb-4 grid size-14 place-items-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 text-neon-cyan"><Icon className="size-6" /></div><h3 className="font-heading text-lg font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{description}</p>{action && <div className="mt-5">{action}</div>}</div></div>
}
