/* eslint-disable react-refresh/only-export-components -- provider and hook intentionally share one context module */
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dataQueryKeys, useProfileQuery } from '@/app/dataQueries'
import { useI18n } from '@/i18n/I18nContext'
import { displayErrorMessage } from '@/i18n/apiErrors'
import type { SupportedLocale } from '@/i18n/locales'
import { readProfileBootstrap } from '@/services/profileBootstrap'
import { repository } from '@/services/repository'
import { enforceSafeUserInput, registerSecurityCachePurge } from '@/security/securityReset'
import type {
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

interface AppDataValue {
  profile: UserProfile | null
  profileLoading: boolean
  profileError: string | null
  refreshProfile: () => Promise<void>
  createCategory: (draft: CategoryDraft) => Promise<Category>
  updateCategory: (id: string, draft: CategoryDraft) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>
  createTransaction: (draft: TransactionDraft) => Promise<void>
  updateTransaction: (id: string, draft: TransactionDraft) => Promise<void>
  deleteTransaction: (transaction: FinancialTransaction) => Promise<void>
  createBudget: (draft: BudgetDraft) => Promise<void>
  pauseBudget: (id: string) => Promise<void>
  resumeBudget: (id: string) => Promise<void>
  archiveBudget: (id: string) => Promise<void>
  loadBudgetPeriods: (id: string) => Promise<BudgetPeriod[]>
  updatePreferences: (preferences: UserPreferences) => Promise<void>
  updateLocale: (locale: SupportedLocale) => Promise<void>
  completeGuidedTour: () => Promise<void>
  purchaseModule: (offerId: string) => Promise<void>
  repairModule: (instanceId: string) => Promise<void>
}

const AppDataContext = createContext<AppDataValue | null>(null)

function errorMessage(error: unknown) {
  return displayErrorMessage(error)
}

function cacheGame(queryClient: QueryClient, game: GameData) {
  queryClient.setQueryData(dataQueryKeys.gameSummary, game.progress)
  queryClient.setQueryData(dataQueryKeys.cyberdeck, game.modules)
  queryClient.setQueryData(dataQueryKeys.storeOffers, game.offers)
  queryClient.setQueryData(dataQueryKeys.gameHistory, game.history)
  queryClient.setQueryData(dataQueryKeys.familyBonuses, game.familyBonuses)
}

function AppDataStateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { syncProfileLocale } = useI18n()
  const [bootstrapProfile] = useState(readProfileBootstrap)
  const profileQuery = useProfileQuery(bootstrapProfile)
  const profile = profileQuery.data ?? null

  useEffect(() => {
    if (profile) syncProfileLocale(profile.locale)
  }, [profile, syncProfileLocale])

  useEffect(() => registerSecurityCachePurge(() => queryClient.clear()), [queryClient])

  const run = useCallback(async <T,>(operation: () => Promise<T>) => {
    try {
      return await operation()
    } catch (caught) {
      throw new Error(errorMessage(caught), { cause: caught })
    }
  }, [])

  const invalidate = useCallback(async (...keys: ReadonlyArray<readonly unknown[]>) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }, [queryClient])

  const refreshProfile = useCallback(async () => {
    await profileQuery.refetch()
  }, [profileQuery])

  const value = useMemo<AppDataValue>(() => ({
    profile,
    profileLoading: profileQuery.isPending,
    profileError: profileQuery.error ? errorMessage(profileQuery.error) : null,
    refreshProfile,
    createCategory: (draft) => run(async () => {
      enforceSafeUserInput(draft)
      const category = await repository.createCategory(draft)
      await invalidate(dataQueryKeys.categories, dataQueryKeys.transactions, dataQueryKeys.dashboard)
      return category
    }),
    updateCategory: (id, draft) => run(async () => {
      enforceSafeUserInput(draft)
      const category = await repository.updateCategory(id, draft)
      await invalidate(dataQueryKeys.categories, dataQueryKeys.transactions, dataQueryKeys.dashboard)
      return category
    }),
    deleteCategory: (id) => run(async () => {
      await repository.deleteCategory(id)
      await invalidate(dataQueryKeys.categories, dataQueryKeys.transactions, dataQueryKeys.dashboard)
    }),
    createTransaction: (draft) => run(async () => {
      enforceSafeUserInput(draft)
      const result = await repository.createTransaction(draft)
      queryClient.setQueryData(dataQueryKeys.dashboard, result.dashboard)
      await invalidate(dataQueryKeys.transactions)
    }),
    updateTransaction: (id, draft) => run(async () => {
      enforceSafeUserInput(draft)
      const result = await repository.updateTransaction(id, draft)
      queryClient.setQueryData(dataQueryKeys.dashboard, result.dashboard)
      await invalidate(dataQueryKeys.transactions)
    }),
    deleteTransaction: (transaction) => run(async () => {
      const result = await repository.deleteTransaction(transaction.id)
      queryClient.setQueryData(dataQueryKeys.dashboard, result.dashboard)
      await invalidate(dataQueryKeys.transactions)
    }),
    createBudget: (draft) => run(async () => {
      enforceSafeUserInput(draft)
      await repository.createBudget(draft)
      await invalidate(dataQueryKeys.budgets, dataQueryKeys.dashboard, dataQueryKeys.gameSummary)
    }),
    pauseBudget: (id) => run(async () => {
      await repository.pauseBudget(id)
      await invalidate(dataQueryKeys.budgets, dataQueryKeys.dashboard, dataQueryKeys.gameSummary)
    }),
    resumeBudget: (id) => run(async () => {
      await repository.resumeBudget(id)
      await invalidate(dataQueryKeys.budgets, dataQueryKeys.dashboard, dataQueryKeys.gameSummary)
    }),
    archiveBudget: (id) => run(async () => {
      await repository.archiveBudget(id)
      await invalidate(dataQueryKeys.budgets, dataQueryKeys.dashboard, dataQueryKeys.gameSummary)
    }),
    loadBudgetPeriods: (id) => run(() => repository.getBudgetPeriods(id)),
    updatePreferences: (preferences) => run(async () => {
      const updated = await repository.updatePreferences(preferences)
      queryClient.setQueryData(dataQueryKeys.profile, updated)
    }),
    updateLocale: (locale) => run(async () => {
      const updated = await repository.updateLocale(locale)
      queryClient.setQueryData(dataQueryKeys.profile, updated)
    }),
    completeGuidedTour: () => run(async () => {
      await repository.completeGuidedTour()
      queryClient.setQueryData<UserProfile>(dataQueryKeys.profile, (current) => current ? { ...current, guidedTourCompleted: true } : current)
    }),
    purchaseModule: (offerId) => run(async () => {
      cacheGame(queryClient, await repository.purchaseModule(offerId))
      await invalidate(dataQueryKeys.profile, dataQueryKeys.dashboard)
    }),
    repairModule: (instanceId) => run(async () => {
      cacheGame(queryClient, await repository.repairModule(instanceId))
      await invalidate(dataQueryKeys.profile, dataQueryKeys.dashboard)
    }),
  }), [invalidate, profile, profileQuery.error, profileQuery.isPending, queryClient, refreshProfile, run])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }))

  return <QueryClientProvider client={queryClient}><AppDataStateProvider>{children}</AppDataStateProvider></QueryClientProvider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData must be used within AppDataProvider.')
  return context
}

export function useOptionalAppData() {
  return useContext(AppDataContext)
}
