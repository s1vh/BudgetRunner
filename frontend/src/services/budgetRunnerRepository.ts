import type {
  AppSnapshot,
  Budget,
  BudgetDraft,
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
  updatePreferences(input: UserPreferences): Promise<UserProfile>
  updateLocale(locale: SupportedLocale): Promise<UserProfile>
  purchaseModule(offerId: string): Promise<GameData>
  repairModule(instanceId: string): Promise<GameData>
}
