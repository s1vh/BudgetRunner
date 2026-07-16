import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { SynthCard } from './primitives'

export function StatCard({ label, value, detail, icon: Icon, tone = 'cyan', trend, footer }: { label: string; value: string; detail?: string; icon: LucideIcon; tone?: 'cyan' | 'magenta' | 'purple'; trend?: 'up' | 'down'; footer?: ReactNode }) {
  const colors = { cyan: 'text-neon-cyan', magenta: 'text-neon-magenta', purple: 'text-tertiary' }
  return (
    <SynthCard className="flex min-h-40 flex-col justify-between p-5" tone={tone} interactive>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase"><Icon className="size-4" />{label}</div>
        {trend && <span className={trend === 'up' ? 'text-success' : 'text-neon-magenta'}>{trend === 'up' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}</span>}
      </div>
      <div>
        <p className={`font-display text-2xl font-black tabular sm:text-3xl ${colors[tone]}`}>{value}</p>
        {detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}
      </div>
      {footer}
    </SynthCard>
  )
}
