export type TransactionType = 'expense' | 'income'
export type TransactionStatus = 'posted' | 'scheduled' | 'voided'
export type BudgetStatus = 'scheduled' | 'active' | 'paused' | 'met' | 'exceeded' | 'archived'
export type BudgetFrequency = 'weekly' | 'monthly'
export type BudgetScope = 'global' | 'category'
export type ModuleFamily = 'retrowave' | 'synthwave' | 'vaporwave' | 'hifi_tech'
export type ModuleRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type ModuleState = 'equipped' | 'destroyed' | 'empty'

export interface LocalizedMessage {
  key: string
  params?: Record<string, string | number>
  fallback?: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  systemKey?: string
}

export type CategoryDraft = Pick<Category, 'name' | 'icon' | 'color'>

export interface FinancialTransaction {
  id: string
  type: TransactionType
  status: TransactionStatus
  concept: string
  amountMinor: number
  currency: string
  categoryId: string
  categoryName: string
  occurredAt: string
  notes?: string
  lockedByReward?: boolean
}

export interface TransactionDraft {
  type: TransactionType
  concept: string
  amountMinor: number
  currency: string
  categoryId: string
  occurredAt: string
  notes?: string
  status?: TransactionStatus
}

export interface Budget {
  id: string
  name: string
  frequency: BudgetFrequency
  scope: BudgetScope
  categoryId?: string
  categoryName?: string
  limitMinor: number
  spendMinor: number
  eligibleSurplusMinor: number
  currency: string
  status: BudgetStatus
  startsAt: string
  endsAt: string
  synthcoinsAwarded?: number
  fluxAwarded?: number
  excludedRewardMinor?: number
}

export interface BudgetDraft {
  name: string
  frequency: BudgetFrequency
  scope: BudgetScope
  categoryId?: string
  limitMinor: number
  currency: string
  startsOn: string
}

export interface BudgetPeriod {
  id: string
  status: 'open' | 'processing' | 'met' | 'exceeded' | 'closed' | 'cancelled'
  startsAt: string
  endsAt: string
  spendMinor: number
  surplusMinor: number
  eligibleSurplusMinor: number
  excludedRewardMinor: number
  synthcoinsAwarded: number
  fluxAwarded: number
  excess_percent_bp: number
  base_damage: number
  evaluatedAt: string | null
}

export interface CashflowPoint {
  label: string
  incomeMinor: number
  expenseMinor: number
}

export interface CategoryDistribution {
  category: string
  systemKey?: string
  amountMinor: number
  percentage: number
  color: string
}

export interface ProgressSummary {
  level: number
  baseFlux: number
  activePower: number
  familyBonusPower: number
  totalFlux: number
  currentLevelFlux: number
  nextLevelFlux: number
  synthcoins: number
  weeklyStreak: number
  monthlyStreak: number
  purchasesLockedUntil?: string
}

export interface DashboardData {
  displayName: string
  systemStatus: string
  balanceMinor: number
  budgetRemainingMinor: number
  currency: string
  distribution: CategoryDistribution[]
  cashflow: CashflowPoint[]
  recentTransactions: FinancialTransaction[]
  progress: ProgressSummary
  alerts: Array<{ id: string; tone: 'info' | 'warning' | 'critical'; message: LocalizedMessage }>
}

export interface CyberModule {
  instanceId: string
  slot: string
  slotLabel: string
  name: string
  family: ModuleFamily
  rarity: ModuleRarity
  power: number
  shield: number
  energy: number
  state: ModuleState
  priceCoins: number
  repairCost?: number
  description: string
  descriptionKey?: string
}

export interface StoreOffer {
  id: string
  module: CyberModule
  expiresAt: string
  netCost: number
  tradeInValue: number
  minLevel: number
}

export interface GameEvent {
  id: string
  type: 'reward' | 'purchase' | 'repair' | 'damage' | 'level'
  title: LocalizedMessage
  detail: LocalizedMessage
  amount?: number
  occurredAt: string
}

export interface GameData {
  progress: ProgressSummary
  modules: CyberModule[]
  offers: StoreOffer[]
  history: GameEvent[]
  familyBonuses: Array<{ family: ModuleFamily; count: number; power: number; bonus: number }>
}

export interface UserProfile {
  id: string
  displayName: string
  email: string
  avatarUrl?: string
  primaryCurrency: string
  locale: string
  timezone: string
  weekStartsOn: number
  googleConnected: boolean
  progress: ProgressSummary
  levelHistory: Array<{ level: number; flux: number; reachedAt: string; reason: LocalizedMessage }>
  guidedTourCompleted: boolean
  preferences: UserPreferences
}

export interface UserPreferences {
  reducedMotion: boolean
  ambientEffects: boolean
  audioReactive: boolean
  scanlines: boolean
  compactMode: boolean
  helpHints: boolean
}

export interface AppSnapshot {
  dashboard: DashboardData
  transactions: FinancialTransaction[]
  budgets: Budget[]
  game: GameData
  profile: UserProfile
  categories: Category[]
}
