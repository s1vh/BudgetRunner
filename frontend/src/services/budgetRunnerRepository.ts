import type {
  Budget,
  BudgetDraft,
  BudgetPeriod,
  Category,
  CategoryDraft,
  CyberModule,
  DashboardData,
  FinancialTransaction,
  GameData,
  GameEvent,
  ProgressSummary,
  StoreOffer,
  TransactionDraft,
  UserPreferences,
  UserProfile,
} from '@/types/domain'
import type { SupportedLocale } from '@/i18n/locales'

export interface TransactionMutationResult {
  transaction: FinancialTransaction
  dashboard: DashboardData
}

export interface TransactionDeletionResult {
  dashboard: DashboardData
}

export interface BudgetRunnerRepository {
  getProfile(): Promise<UserProfile>
  getDashboard(): Promise<DashboardData>
  getTransactions(): Promise<FinancialTransaction[]>
  getCategories(): Promise<Category[]>
  getBudgets(): Promise<Budget[]>
  getGameSummary(): Promise<ProgressSummary>
  getCyberdeck(): Promise<CyberModule[]>
  getStoreOffers(): Promise<StoreOffer[]>
  getGameHistory(): Promise<GameEvent[]>
  getFamilyBonuses(): Promise<GameData['familyBonuses']>
  createCategory(input: CategoryDraft): Promise<Category>
  updateCategory(id: string, input: CategoryDraft): Promise<Category>
  deleteCategory(id: string): Promise<void>
  createTransaction(input: TransactionDraft): Promise<TransactionMutationResult>
  updateTransaction(id: string, input: TransactionDraft): Promise<TransactionMutationResult>
  deleteTransaction(id: string): Promise<TransactionDeletionResult>
  createBudget(input: BudgetDraft): Promise<Budget>
  pauseBudget(id: string): Promise<Budget>
  resumeBudget(id: string): Promise<Budget>
  archiveBudget(id: string): Promise<void>
  getBudgetPeriods(id: string): Promise<BudgetPeriod[]>
  updatePreferences(input: UserPreferences): Promise<UserProfile>
  updateLocale(locale: SupportedLocale): Promise<UserProfile>
  completeGuidedTour(): Promise<void>
  purchaseModule(offerId: string): Promise<GameData>
  repairModule(instanceId: string): Promise<GameData>
}
