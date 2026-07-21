import { cashflow, categories as initialCategories, gameHistory, initialBudgets, initialTransactions, modules, offers, profile, progress } from '@/data/mockData'
import type { BudgetRunnerRepository } from './budgetRunnerRepository'
import type {
  AppSnapshot,
  Budget,
  BudgetDraft,
  Category,
  CategoryDraft,
  CategoryDistribution,
  FinancialTransaction,
  TransactionDraft,
  UserPreferences,
  UserProfile,
} from '@/types/domain'
import { detectSystemLocale, readStoredLocale, type SupportedLocale } from '@/i18n/locales'
import { createId } from '@/utils/format'

const wait = (milliseconds = 180) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export class MockBudgetRunnerRepository implements BudgetRunnerRepository {
  private transactions = [...initialTransactions]
  private budgets = [...initialBudgets]
  private categories = structuredClone(initialCategories)
  private currentProfile = { ...structuredClone(profile), locale: readStoredLocale() ?? detectSystemLocale() }

  private categoryName(categoryId: string) {
    return this.categories.find((category) => category.id === categoryId)?.name ?? 'Otros'
  }

  private distribution(): CategoryDistribution[] {
    const postedExpenses = this.transactions.filter((transaction) => transaction.type === 'expense' && transaction.status === 'posted')
    const total = postedExpenses.reduce((sum, transaction) => sum + transaction.amountMinor, 0)
    const grouped = new Map<string, number>()
    postedExpenses.forEach((transaction) => grouped.set(transaction.categoryId, (grouped.get(transaction.categoryId) ?? 0) + transaction.amountMinor))

    return [...grouped.entries()]
      .map(([categoryId, amountMinor]) => {
        const category = this.categories.find((item) => item.id === categoryId)
        return {
          category: category?.name ?? 'Otros',
          ...(category?.systemKey ? { systemKey: category.systemKey } : {}),
          amountMinor,
          percentage: total > 0 ? Math.round((amountMinor / total) * 100) : 0,
          color: category?.color ?? '#986780',
        }
      })
      .sort((a, b) => b.amountMinor - a.amountMinor)
      .slice(0, 5)
  }

  async getSnapshot(): Promise<AppSnapshot> {
    await wait()
    const posted = this.transactions.filter((transaction) => transaction.status === 'posted')
    const income = posted.filter((transaction) => transaction.type === 'income').reduce((sum, item) => sum + item.amountMinor, 0)
    const expenses = posted.filter((transaction) => transaction.type === 'expense').reduce((sum, item) => sum + item.amountMinor, 0)
    const activeBudgets = this.budgets.filter((budget) => budget.status === 'active')
    const remaining = activeBudgets.reduce((sum, budget) => sum + Math.max(0, budget.limitMinor - budget.spendMinor), 0)

    return structuredClone({
      dashboard: {
        displayName: this.currentProfile.displayName,
        systemStatus: 'dashboard.systemOnline',
        balanceMinor: income - expenses,
        budgetRemainingMinor: remaining,
        currency: this.currentProfile.primaryCurrency,
        distribution: this.distribution(),
        cashflow,
        recentTransactions: [...this.transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 5),
        progress,
        alerts: [
          { id: 'alert-1', tone: 'warning', message: { key: 'alert.criticalModule', params: { name: 'Ghostlink Q7', energy: 18 } } },
          { id: 'alert-2', tone: 'info', message: { key: 'alert.storeRotation.other', params: { days: 5 } } },
        ] as AppSnapshot['dashboard']['alerts'],
      },
      transactions: [...this.transactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
      budgets: this.budgets,
      game: {
        progress,
        modules,
        offers,
        history: gameHistory,
        familyBonuses: [
          { family: 'retrowave', count: 2, power: 310, bonus: 15 },
          { family: 'synthwave', count: 2, power: 325, bonus: 16 },
          { family: 'vaporwave', count: 3, power: 520, bonus: 62 },
          { family: 'hifi_tech', count: 1, power: 280, bonus: 0 },
        ],
      },
      profile: this.currentProfile,
      categories: this.categories,
    })
  }

  async createCategory(input: CategoryDraft): Promise<Category> {
    await wait(180)
    if (this.categories.some((category) => category.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) {
      throw new Error('RESOURCE_CONFLICT')
    }
    const category = { id: createId('category'), ...input }
    this.categories = [...this.categories, category]
    return structuredClone(category)
  }

  async updateCategory(id: string, input: CategoryDraft): Promise<Category> {
    await wait(180)
    const current = this.categories.find((category) => category.id === id)
    if (!current) throw new Error('CATEGORY_NOT_FOUND')
    if (this.categories.some((category) => category.id !== id && category.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) {
      throw new Error('RESOURCE_CONFLICT')
    }
    const category = { ...current, ...input, systemKey: current.name === input.name ? current.systemKey : undefined }
    this.categories = this.categories.map((item) => item.id === id ? category : item)
    this.transactions = this.transactions.map((transaction) => transaction.categoryId === id
      ? { ...transaction, categoryName: category.name }
      : transaction)
    return structuredClone(category)
  }

  async deleteCategory(id: string): Promise<void> {
    await wait(180)
    this.categories = this.categories.filter((category) => category.id !== id)
  }

  async createTransaction(input: TransactionDraft): Promise<FinancialTransaction> {
    await wait(260)
    const transaction: FinancialTransaction = {
      ...input,
      id: createId('tx'),
      categoryName: this.categoryName(input.categoryId),
      status: input.status ?? 'posted',
    }
    this.transactions = [transaction, ...this.transactions]
    return structuredClone(transaction)
  }

  async updateTransaction(id: string, input: TransactionDraft): Promise<FinancialTransaction> {
    await wait(260)
    const current = this.transactions.find((transaction) => transaction.id === id)
    if (!current) throw new Error('TRANSACTION_NOT_FOUND')
    if (current.lockedByReward) throw new Error('REWARDED_TRANSACTION_LOCKED')
    const updated = { ...current, ...input, categoryName: this.categoryName(input.categoryId), status: input.status ?? current.status }
    this.transactions = this.transactions.map((transaction) => transaction.id === id ? updated : transaction)
    return structuredClone(updated)
  }

  async deleteTransaction(id: string): Promise<void> {
    await wait(220)
    const current = this.transactions.find((transaction) => transaction.id === id)
    if (current?.lockedByReward) throw new Error('REWARDED_TRANSACTION_LOCKED')
    this.transactions = this.transactions.filter((transaction) => transaction.id !== id)
  }

  async createBudget(input: BudgetDraft): Promise<Budget> {
    await wait(260)
    const start = new Date(input.startsOn)
    const end = new Date(start)
    if (input.frequency === 'weekly') end.setUTCDate(end.getUTCDate() + 7)
    else end.setUTCMonth(end.getUTCMonth() + 1)
    const budget: Budget = {
      ...input,
      id: createId('budget'),
      categoryName: input.categoryId ? this.categoryName(input.categoryId) : undefined,
      spendMinor: 0,
      eligibleSurplusMinor: 0,
      status: start.getTime() > Date.now() ? 'scheduled' : 'active',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
    }
    this.budgets = [budget, ...this.budgets]
    return structuredClone(budget)
  }

  async updatePreferences(input: UserPreferences): Promise<UserProfile> {
    await wait(180)
    this.currentProfile = { ...this.currentProfile, preferences: input }
    return structuredClone(this.currentProfile)
  }

  async updateLocale(locale: SupportedLocale): Promise<UserProfile> {
    await wait(120)
    this.currentProfile = { ...this.currentProfile, locale }
    return structuredClone(this.currentProfile)
  }

  async purchaseModule(): Promise<AppSnapshot['game']> {
    return (await this.getSnapshot()).game
  }

  async repairModule(): Promise<AppSnapshot['game']> {
    return (await this.getSnapshot()).game
  }
}
