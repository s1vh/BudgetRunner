import type {
  AppSnapshot,
  Budget,
  BudgetDraft,
  FinancialTransaction,
  TransactionDraft,
  UserPreferences,
  UserProfile,
} from '@/types/domain'

export interface BudgetRunnerRepository {
  getSnapshot(): Promise<AppSnapshot>
  createTransaction(input: TransactionDraft): Promise<FinancialTransaction>
  updateTransaction(id: string, input: TransactionDraft): Promise<FinancialTransaction>
  deleteTransaction(id: string): Promise<void>
  createBudget(input: BudgetDraft): Promise<Budget>
  updatePreferences(input: UserPreferences): Promise<UserProfile>
}
