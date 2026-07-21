import type { CategoryDistribution } from '@/types/domain'
import { formatMoney } from '@/utils/format'
import { useI18n } from '@/i18n/I18nContext'

export function DonutChart({ data, currency = 'EUR', title }: { data: CategoryDistribution[]; currency?: string; title: string }) {
  const { t, td } = useI18n()
  const label = (item: CategoryDistribution) => item.systemKey ? td({ key: item.systemKey, fallback: item.category }) : item.category
  const total = data.reduce((sum, item) => sum + item.amountMinor, 0)
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const segments = data.map((item, index) => ({
    item,
    length: (item.percentage / 100) * circumference,
    offset: -data.slice(0, index).reduce((sum, previous) => sum + (previous.percentage / 100) * circumference, 0),
  }))

  return (
    <div className="grid min-h-64 items-center gap-7 md:grid-cols-[minmax(180px,0.8fr)_1.2fr]" role="img" aria-label={t('chart.totalAria', { title, total: formatMoney(total, currency) })}>
      <div className="relative mx-auto size-52">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90 overflow-visible" aria-hidden="true">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#451232" strokeWidth="14" />
          {segments.map(({ item, length, offset }) => {
            return (
              <circle
                key={item.category}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="14"
                strokeLinecap="butt"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
                style={{ filter: `drop-shadow(0 0 3px ${item.color})` }}
              >
                <title>{label(item)}: {formatMoney(item.amountMinor, currency)} ({item.percentage}%)</title>
              </circle>
            )
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div><strong className="font-display text-xl text-text-glow tabular">{formatMoney(total, currency)}</strong><span className="mt-1 block font-mono text-[10px] tracking-widest text-text-muted uppercase">{t('chart.spent')}</span></div>
        </div>
      </div>
      <ul className="grid gap-3">
        {data.map((item) => (
          <li key={item.category} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-white/6 bg-white/[0.025] px-3 py-2.5">
            <span className="size-2.5 rounded-full" style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }} aria-hidden="true" />
            <span className="min-w-0 truncate text-sm text-text-muted">{label(item)}</span>
            <span className="font-mono text-xs text-text-glow tabular">{item.percentage}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
