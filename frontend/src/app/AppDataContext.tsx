/* eslint-disable react-refresh/only-export-components -- provider and hook intentionally share one context module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { repository } from '@/services/repository'
import type {
  AppSnapshot,
  BudgetDraft,
  BudgetPeriod,
  Category,
  CategoryDraft,
  FinancialTransaction,
  TransactionDraft,
  UserPreferences,
} from '@/types/domain'
import { useI18n } from '@/i18n/I18nContext'
import type { SupportedLocale } from '@/i18n/locales'
import { displayErrorMessage } from '@/i18n/apiErrors'

interface AppDataValue {
  data: AppSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
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

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { syncProfileLocale } = useI18n()
  const [data, setData] = useState<AppSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const snapshot = await repository.getSnapshot()
      setData(snapshot)
      syncProfileLocale(snapshot.profile.locale)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [syncProfileLocale])

  useEffect(() => {
    let active = true
    repository.getSnapshot()
      .then((snapshot) => { if (active) { setData(snapshot); syncProfileLocale(snapshot.profile.locale) } })
      .catch((caught: unknown) => { if (active) setError(errorMessage(caught)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [syncProfileLocale])

  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    setError(null)
    try {
      await operation()
      await refresh()
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      throw new Error(message, { cause: caught })
    }
  }, [refresh])

  const value = useMemo<AppDataValue>(() => ({
    data,
    loading,
    error,
    refresh,
    createCategory: async (draft) => {
      let category: Category | undefined
      await mutate(async () => { category = await repository.createCategory(draft) })
      if (!category) throw new Error(displayErrorMessage(new Error('INTERNAL_ERROR')))
      return category
    },
    updateCategory: async (id, draft) => {
      let category: Category | undefined
      await mutate(async () => { category = await repository.updateCategory(id, draft) })
      if (!category) throw new Error(displayErrorMessage(new Error('INTERNAL_ERROR')))
      return category
    },
    deleteCategory: (id) => mutate(() => repository.deleteCategory(id)),
    createTransaction: (draft) => mutate(() => repository.createTransaction(draft)),
    updateTransaction: (id, draft) => mutate(() => repository.updateTransaction(id, draft)),
    deleteTransaction: (transaction) => mutate(() => repository.deleteTransaction(transaction.id)),
    createBudget: (draft) => mutate(() => repository.createBudget(draft)),
    pauseBudget: (id) => mutate(() => repository.pauseBudget(id)),
    resumeBudget: (id) => mutate(() => repository.resumeBudget(id)),
    archiveBudget: (id) => mutate(() => repository.archiveBudget(id)),
    loadBudgetPeriods: (id) => repository.getBudgetPeriods(id),
    updatePreferences: (preferences) => mutate(() => repository.updatePreferences(preferences)),
    updateLocale: (locale) => mutate(() => repository.updateLocale(locale)),
    completeGuidedTour: () => mutate(() => repository.completeGuidedTour()),
    purchaseModule: (offerId) => mutate(() => repository.purchaseModule(offerId)),
    repairModule: (instanceId) => mutate(() => repository.repairModule(instanceId)),
  }), [data, error, loading, mutate, refresh])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData must be used within AppDataProvider.')
  return context
}

export function useOptionalAppData() {
  return useContext(AppDataContext)
}
