import type { CashflowPoint } from '@/types/domain'
import { formatMoney, formatMonth } from '@/utils/format'
import { useI18n } from '@/i18n/I18nContext'

export function CashflowBarChart({ data, currency = 'EUR' }: { data: CashflowPoint[]; currency?: string }) {
  const { t } = useI18n()
  const maxValue = Math.max(1, ...data.flatMap((point) => [point.incomeMinor, point.expenseMinor]))
  const chartHeight = 190
  const baseline = 220
  const groupWidth = 640 / Math.max(1, data.length)
  const barWidth = Math.min(22, groupWidth * 0.26)

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 font-mono text-[10px] tracking-wider uppercase">
        <span className="flex items-center gap-2 text-text-muted"><i className="size-2 rounded-full bg-neon-cyan shadow-[0_0_8px_#00ffff]" />{t('chart.income')}</span>
        <span className="flex items-center gap-2 text-text-muted"><i className="size-2 rounded-full bg-neon-magenta shadow-[0_0_8px_#ff007f]" />{t('chart.expenses')}</span>
      </div>
      <div className="overflow-x-auto pb-2">
        <svg viewBox="0 0 700 260" className="min-w-[620px]" role="img" aria-label={t('chart.cashflowAria')}>
          <defs>
            <linearGradient id="income-bars" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#00ffff" stopOpacity="0.82" /><stop offset="1" stopColor="#00ffff" stopOpacity="0.16" /></linearGradient>
            <linearGradient id="expense-bars" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff007f" stopOpacity="0.82" /><stop offset="1" stopColor="#ff007f" stopOpacity="0.16" /></linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = baseline - chartHeight * tick
            return <g key={tick}><line x1="44" y1={y} x2="686" y2={y} stroke="#663a52" strokeOpacity="0.45" strokeDasharray="4 7" /><text x="38" y={y + 4} fill="#9b91ad" fontFamily="Courier Prime" fontSize="9" textAnchor="end">{Math.round((maxValue * tick) / 10000) / 10}k</text></g>
          })}
          {data.map((point, index) => {
            const centerX = 44 + groupWidth * index + groupWidth / 2
            const incomeHeight = (point.incomeMinor / maxValue) * chartHeight
            const expenseHeight = (point.expenseMinor / maxValue) * chartHeight
            return (
              <g key={point.label} tabIndex={0} aria-label={`${formatMonth(point.label)}: ${t('chart.income')} ${formatMoney(point.incomeMinor, currency)}, ${t('chart.expenses')} ${formatMoney(point.expenseMinor, currency)}`}>
                <rect x={centerX - barWidth - 2} y={baseline - incomeHeight} width={barWidth} height={incomeHeight} rx="3" fill="url(#income-bars)" stroke="#00ffff" strokeOpacity="0.5"><title>{t('chart.income')}: {formatMoney(point.incomeMinor, currency)}</title></rect>
                <rect x={centerX + 2} y={baseline - expenseHeight} width={barWidth} height={expenseHeight} rx="3" fill="url(#expense-bars)" stroke="#ff007f" strokeOpacity="0.5"><title>{t('chart.expenses')}: {formatMoney(point.expenseMinor, currency)}</title></rect>
                <text x={centerX} y="244" fill="#9b91ad" fontFamily="Courier Prime" fontSize="10" textAnchor="middle">{formatMonth(point.label)}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
