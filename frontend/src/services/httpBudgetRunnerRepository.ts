import { initialBudgets } from '@/data/mockData'
import { apiClient, idempotencyHeaders } from './apiClient'
import type { BudgetRunnerRepository } from './budgetRunnerRepository'
import type {
  AppSnapshot, Budget, Category, CyberModule, DashboardData, FinancialTransaction,
  GameData, GameEvent, ProgressSummary, StoreOffer, TransactionDraft, UserPreferences, UserProfile,
} from '@/types/domain'

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

function normalizeGame(game: ApiGame): GameData {
  return {
    progress: game.progress,
    modules: game.slots.map((slot): CyberModule => slot.module ? {
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
    }),
    offers: game.offers.map((offer): StoreOffer => ({
      ...offer,
      module: { ...offer.module, instanceId: `offer-${offer.id}` },
    })),
    history: game.history,
    familyBonuses: game.familyBonuses,
  }
}

export class HttpBudgetRunnerRepository implements BudgetRunnerRepository {
  async getSnapshot(): Promise<AppSnapshot> {
    const [dashboard, transactions, categories, progress, slots, offers, history, familyBonuses, profile] = await Promise.all([
      apiClient.request<DashboardData>('/dashboard?period=month'),
      apiClient.request<FinancialTransaction[]>('/transactions?page=1&pageSize=100'),
      apiClient.request<Category[]>('/categories'),
      apiClient.request<ProgressSummary>('/game/summary'),
      apiClient.request<ApiSlot[]>('/game/cyberdeck'),
      apiClient.request<ApiOffer[]>('/game/store'),
      apiClient.request<GameEvent[]>('/game/history'),
      apiClient.request<GameData['familyBonuses']>('/game/family-bonuses'),
      apiClient.request<UserProfile>('/me'),
    ])
    return {
      dashboard,
      transactions,
      budgets: initialBudgets,
      game: normalizeGame({ progress, slots, offers, history, familyBonuses }),
      profile,
      categories,
    }
  }

  async createTransaction(input: TransactionDraft): Promise<FinancialTransaction> {
    const result = await apiClient.request<{ transaction: FinancialTransaction; dashboard: DashboardData }>('/transactions', {
      method: 'POST', headers: idempotencyHeaders(), body: JSON.stringify(input),
    })
    return result.transaction
  }

  async updateTransaction(id: string, input: TransactionDraft): Promise<FinancialTransaction> {
    const result = await apiClient.request<{ transaction: FinancialTransaction; dashboard: DashboardData }>(`/transactions/${id}`, {
      method: 'PATCH', headers: idempotencyHeaders(), body: JSON.stringify(input),
    })
    return result.transaction
  }

  async deleteTransaction(id: string): Promise<void> {
    await apiClient.request(`/transactions/${id}`, { method: 'DELETE', headers: idempotencyHeaders() })
  }

  createBudget(): Promise<Budget> {
    return Promise.reject(new Error('La persistencia de presupuestos se implementará en la siguiente vertical del backend.'))
  }

  async updatePreferences(input: UserPreferences): Promise<UserProfile> {
    return apiClient.request<UserProfile>('/me', { method: 'PATCH', body: JSON.stringify({ preferences: input }) })
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
