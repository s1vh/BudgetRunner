/* eslint-disable react-refresh/only-export-components -- provider and hook intentionally share one context module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { repository } from '@/services/repository'
import type {
  AppSnapshot,
  BudgetDraft,
  FinancialTransaction,
  TransactionDraft,
  UserPreferences,
} from '@/types/domain'

interface AppDataValue {
  data: AppSnapshot | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createTransaction: (draft: TransactionDraft) => Promise<void>
  updateTransaction: (id: string, draft: TransactionDraft) => Promise<void>
  deleteTransaction: (transaction: FinancialTransaction) => Promise<void>
  createBudget: (draft: BudgetDraft) => Promise<void>
  updatePreferences: (preferences: UserPreferences) => Promise<void>
}

const AppDataContext = createContext<AppDataValue | null>(null)

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Se ha producido un error inesperado.'
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      setData(await repository.getSnapshot())
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    repository.getSnapshot()
      .then((snapshot) => { if (active) setData(snapshot) })
      .catch((caught: unknown) => { if (active) setError(errorMessage(caught)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const mutate = useCallback(async (operation: () => Promise<unknown>) => {
    setError(null)
    try {
      await operation()
      await refresh()
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      throw caught
    }
  }, [refresh])

  const value = useMemo<AppDataValue>(() => ({
    data,
    loading,
    error,
    refresh,
    createTransaction: (draft) => mutate(() => repository.createTransaction(draft)),
    updateTransaction: (id, draft) => mutate(() => repository.updateTransaction(id, draft)),
    deleteTransaction: (transaction) => mutate(() => repository.deleteTransaction(transaction.id)),
    createBudget: (draft) => mutate(() => repository.createBudget(draft)),
    updatePreferences: (preferences) => mutate(() => repository.updatePreferences(preferences)),
  }), [data, error, loading, mutate, refresh])

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData debe utilizarse dentro de AppDataProvider.')
  return context
}
