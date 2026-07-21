import type {
  AppSnapshot,
  Budget,
  BudgetDraft,
  BudgetPeriod,
  Category,
  CategoryDraft,
  FinancialTransaction,
  GameData,
  TransactionDraft,
  UserPreferences,
  UserProfile,
} from '@/types/domain'
import type { SupportedLocale } from '@/i18n/locales'

export interface BudgetRunnerRepository {
  getSnapshot(): Promise<AppSnapshot>
  createCategory(input: CategoryDraft): Promise<Category>
  updateCategory(id: string, input: CategoryDraft): Promise<Category>
  deleteCategory(id: string): Promise<void>
  createTransaction(input: TransactionDraft): Promise<FinancialTransaction>
  updateTransaction(id: string, input: TransactionDraft): Promise<FinancialTransaction>
  deleteTransaction(id: string): Promise<void>
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
