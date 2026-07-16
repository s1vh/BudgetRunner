import type { BudgetRunnerRepository } from './budgetRunnerRepository'
import { HttpBudgetRunnerRepository } from './httpBudgetRunnerRepository'
import { MockBudgetRunnerRepository } from './mockBudgetRunnerRepository'

export const repository: BudgetRunnerRepository = import.meta.env.VITE_DATA_SOURCE === 'api'
  ? new HttpBudgetRunnerRepository()
  : new MockBudgetRunnerRepository()
