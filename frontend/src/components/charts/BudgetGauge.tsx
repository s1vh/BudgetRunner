import { Progress } from '@/components/ui/primitives'
import { formatMoney } from '@/utils/format'

export function BudgetGauge({ spendMinor, limitMinor, currency, compact = false }: { spendMinor: number; limitMinor: number; currency: string; compact?: boolean }) {
  const percentage = limitMinor > 0 ? Math.round((spendMinor / limitMinor) * 100) : 0
  const remaining = Math.max(0, limitMinor - spendMinor)
  const tone = percentage > 100 ? 'magenta' : percentage >= 80 ? 'warning' : 'cyan'
  return (
    <div className="grid gap-2">
      <Progress value={Math.min(percentage, 100)} tone={tone} />
      <div className="flex items-center justify-between gap-3 font-mono text-[11px] text-text-muted">
        <span className="tabular">{formatMoney(spendMinor, currency)} / {formatMoney(limitMinor, currency)}</span>
        {!compact && <span className={percentage > 100 ? 'text-neon-magenta' : 'text-text-muted'}>{percentage > 100 ? `${percentage - 100}% excedido` : `${formatMoney(remaining, currency)} restante`}</span>}
      </div>
    </div>
  )
}
