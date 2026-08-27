import { initialBudgets } from '@/data/mockData'
import { apiClient, idempotencyHeaders } from './apiClient'
import type { BudgetRunnerRepository } from './budgetRunnerRepository'
import type {
  Budget, Category, CategoryDraft, CyberModule, DashboardData, FinancialTransaction,
  GameData, GameEvent, ProgressSummary, StoreOffer, TransactionDraft, UserPreferences, UserProfile,
} from '@/types/domain'
import type { SupportedLocale } from '@/i18n/locales'

interface ApiSlot {
  slot: string
  label: string
  module: Omit<CyberModule, 'slot' | 'slotLabel'> | null
}

interface ApiOffer extends Omit<StoreOffer, 'module'> {
  module: Omit<CyberModule, 'instanceId'> & { definitionId: string }
}

interface ApiGame {
  progress: ProgressSummary
  slots: ApiSlot[]
  offers: ApiOffer[]
  history: GameEvent[]
  familyBonuses: GameData['familyBonuses']
}

const emptyFamilies: Record<string, CyberModule['family']> = {
  cpu: 'synthwave', gpu: 'vaporwave', ram: 'synthwave', display: 'retrowave', expansion: 'hifi_tech',
  jammer: 'synthwave', network: 'vaporwave', cooling: 'hifi_tech', projector: 'retrowave', power: 'hifi_tech',
}

function normalizeCyberdeck(slots: ApiSlot[]): CyberModule[] {
  return slots.map((slot): CyberModule => slot.module ? {
      ...slot.module,
      slot: slot.slot,
      slotLabel: slot.label,
    } : {
      instanceId: `empty-${slot.slot}`,
      slot: slot.slot,
      slotLabel: slot.label,
      name: 'Sin módulo',
      family: emptyFamilies[slot.slot] ?? 'synthwave',
      rarity: 'common',
      power: 0,
      shield: 0,
      energy: 0,
      state: 'empty',
      priceCoins: 0,
      description: 'Slot disponible para una futura adquisición.',
      descriptionKey: 'game.emptySlotDescription',
    })
}

function normalizeOffers(offers: ApiOffer[]): StoreOffer[] {
  return offers.map((offer): StoreOffer => ({
      ...offer,
      module: { ...offer.module, instanceId: `offer-${offer.id}` },
    }))
}

function normalizeGame(game: ApiGame): GameData {
  return {
    progress: game.progress,
    modules: normalizeCyberdeck(game.slots),
    offers: normalizeOffers(game.offers),
    history: game.history,
    familyBonuses: game.familyBonuses,
  }
}

export class HttpBudgetRunnerRepository implements BudgetRunnerRepository {
  getProfile(): Promise<UserProfile> {
    return apiClient.request<UserProfile>('/me')
  }

  getDashboard(): Promise<DashboardData> {
    return apiClient.request<DashboardData>('/dashboard?period=month')
  }

  getTransactions(): Promise<FinancialTransaction[]> {
    return apiClient.request<FinancialTransaction[]>('/transactions?page=1&pageSize=100')
  }

  getCategories(): Promise<Category[]> {
    return apiClient.request<Category[]>('/categories')
  }

  async getBudgets(): Promise<Budget[]> {
    return structuredClone(initialBudgets)
  }

  getGameSummary(): Promise<ProgressSummary> {
    return apiClient.request<ProgressSummary>('/game/summary')
  }

  async getCyberdeck(): Promise<CyberModule[]> {
    return normalizeCyberdeck(await apiClient.request<ApiSlot[]>('/game/cyberdeck'))
  }

  async getStoreOffers(): Promise<StoreOffer[]> {
    return normalizeOffers(await apiClient.request<ApiOffer[]>('/game/store'))
  }

  getGameHistory(): Promise<GameEvent[]> {
    return apiClient.request<GameEvent[]>('/game/history')
  }

  getFamilyBonuses(): Promise<GameData['familyBonuses']> {
    return apiClient.request<GameData['familyBonuses']>('/game/family-bonuses')
  }

  async createCategory(input: CategoryDraft): Promise<Category> {
    return apiClient.request<Category>('/categories', { method: 'POST', body: JSON.stringify(input) })
  }

  async updateCategory(id: string, input: CategoryDraft): Promise<Category> {
    return apiClient.request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  }

  async deleteCategory(id: string): Promise<void> {
    await apiClient.request(`/categories/${id}`, { method: 'DELETE' })
  }

  createTransaction(input: TransactionDraft) {
    return apiClient.request<{ transaction: FinancialTransaction; dashboard: DashboardData }>('/transactions', {
      method: 'POST', headers: idempotencyHeaders(), body: JSON.stringify(input),
    })
  }

  updateTransaction(id: string, input: TransactionDraft) {
    return apiClient.request<{ transaction: FinancialTransaction; dashboard: DashboardData }>(`/transactions/${id}`, {
      method: 'PATCH', headers: idempotencyHeaders(), body: JSON.stringify(input),
    })
  }

  deleteTransaction(id: string) {
    return apiClient.request<{ dashboard: DashboardData }>(`/transactions/${id}`, { method: 'DELETE', headers: idempotencyHeaders() })
  }

  createBudget(): Promise<Budget> {
    return Promise.reject(new Error('La persistencia de presupuestos se implementará en la siguiente vertical del backend.'))
  }

  async updatePreferences(input: UserPreferences): Promise<UserProfile> {
    return apiClient.request<UserProfile>('/me', { method: 'PATCH', body: JSON.stringify({ preferences: input }) })
  }

  async updateLocale(locale: SupportedLocale): Promise<UserProfile> {
    return apiClient.request<UserProfile>('/me', { method: 'PATCH', body: JSON.stringify({ locale }) })
  }

  async completeGuidedTour(): Promise<void> {
    await apiClient.request('/me/guided-tour/complete', { method: 'POST' })
  }

  async purchaseModule(offerId: string): Promise<GameData> {
    const result = await apiClient.request<{ game: ApiGame }>(`/game/store/offers/${offerId}/purchase`, {
      method: 'POST', headers: idempotencyHeaders(),
    })
    return normalizeGame(result.game)
  }

  async repairModule(instanceId: string): Promise<GameData> {
    const result = await apiClient.request<{ game: ApiGame }>(`/game/modules/${instanceId}/repair`, {
      method: 'POST', headers: idempotencyHeaders(),
    })
    return normalizeGame(result.game)
  }
}
