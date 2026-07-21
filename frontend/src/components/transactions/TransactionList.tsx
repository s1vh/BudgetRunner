import { CalendarClock, Cpu, Fuel, Gamepad2, HeartPulse, Home, LockKeyhole, ReceiptText, Utensils, Wallet, type LucideIcon } from 'lucide-react'
import type { Category, FinancialTransaction } from '@/types/domain'
import { formatMoney, formatShortDate } from '@/utils/format'
import { useI18n } from '@/i18n/I18nContext'
import { categoryLabel } from '@/i18n/categoryLabel'

const categoryIcons: Record<string, LucideIcon> = {
  'cat-food': Utensils,
  'cat-tech': Cpu,
  'cat-home': Home,
  'cat-fuel': Fuel,
  'cat-fun': Gamepad2,
  'cat-health': HeartPulse,
  'cat-income': Wallet,
}

export function TransactionList({ transactions, categories = [], limit, onSelect }: { transactions: FinancialTransaction[]; categories?: Category[]; limit?: number; onSelect?: (transaction: FinancialTransaction) => void }) {
  const { t, td } = useI18n()
  const visible = typeof limit === 'number' ? transactions.slice(0, limit) : transactions
  return (
    <ul className="divide-y divide-outline-soft/45">
      {visible.map((transaction) => {
        const Icon = categoryIcons[transaction.categoryId] ?? ReceiptText
        const positive = transaction.type === 'income'
        return (
          <li key={transaction.id}>
            <button type="button" onClick={() => onSelect?.(transaction)} className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-1 py-3 text-left transition hover:bg-white/[0.035] sm:px-2">
              <span className={`icon-chip ${positive ? 'border-neon-cyan/25 text-neon-cyan' : 'border-neon-magenta/20 text-neon-magenta'}`}><Icon className="size-[18px]" /></span>
              <span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-sm text-text-glow">{transaction.concept}</strong>{transaction.lockedByReward && <LockKeyhole className="size-3 text-sunset" aria-label={t('lockedByReward')} />}</span><small className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-text-muted"><span className="truncate">{categoryLabel(categories.find((item) => item.id === transaction.categoryId) ?? { name: transaction.categoryName }, td)}</span><span aria-hidden="true">·</span>{transaction.status === 'scheduled' && <CalendarClock className="size-3 text-tertiary" />}{formatShortDate(transaction.occurredAt)}</small></span>
              <span className={`font-mono text-xs font-bold tabular sm:text-sm ${positive ? 'text-neon-cyan' : 'text-neon-magenta'}`}>{positive ? '+' : '−'}{formatMoney(transaction.amountMinor, transaction.currency)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
