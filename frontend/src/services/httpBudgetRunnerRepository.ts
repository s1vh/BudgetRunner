import type { BudgetRunnerRepository } from './budgetRunnerRepository'
import type {
  AppSnapshot,
  Budget,
  FinancialTransaction,
  UserProfile,
} from '@/types/domain'

/**
 * Adapter placeholder for API.md. It deliberately fails until the backend exists,
 * while keeping every feature dependent on the repository contract rather than mocks.
 */
export class HttpBudgetRunnerRepository implements BudgetRunnerRepository {
  constructor(private readonly baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1') {}

  private unavailable(): never {
    throw new Error(`API no disponible todavía (${this.baseUrl}). Usa VITE_DATA_SOURCE=mock.`)
  }

  getSnapshot(): Promise<AppSnapshot> { return Promise.reject(this.unavailable()) }
  createTransaction(): Promise<FinancialTransaction> { return Promise.reject(this.unavailable()) }
  updateTransaction(): Promise<FinancialTransaction> { return Promise.reject(this.unavailable()) }
  deleteTransaction(): Promise<void> { return Promise.reject(this.unavailable()) }
  createBudget(): Promise<Budget> { return Promise.reject(this.unavailable()) }
  updatePreferences(): Promise<UserProfile> { return Promise.reject(this.unavailable()) }
}
