import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageHeader({ eyebrow, title, description, icon: Icon, actions }: { eyebrow: string; title: string; description: string; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-neon-cyan uppercase">
          {Icon && <Icon className="size-4" aria-hidden="true" />}{eyebrow}
        </div>
        <h1 className="font-display text-3xl leading-tight font-black tracking-[-0.03em] text-text-glow sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted sm:text-base">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}
