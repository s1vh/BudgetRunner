import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { repository } from '@/services/repository'
import type { UserProfile } from '@/types/domain'

export const dataQueryKeys = {
  profile: ['app-data', 'profile'] as const,
  dashboard: ['app-data', 'dashboard'] as const,
  transactions: ['app-data', 'transactions'] as const,
  categories: ['app-data', 'categories'] as const,
  budgets: ['app-data', 'budgets'] as const,
  budgetPeriods: (budgetId: string) => ['app-data', 'budgets', budgetId, 'periods'] as const,
  gameSummary: ['app-data', 'game', 'summary'] as const,
  cyberdeck: ['app-data', 'game', 'cyberdeck'] as const,
  storeOffers: ['app-data', 'game', 'store'] as const,
  gameHistory: ['app-data', 'game', 'history'] as const,
  familyBonuses: ['app-data', 'game', 'family-bonuses'] as const,
}

const profileOptions = queryOptions({
  queryKey: dataQueryKeys.profile,
  queryFn: () => repository.getProfile(),
  staleTime: 5 * 60_000,
})

export const dashboardQueryOptions = queryOptions({
  queryKey: dataQueryKeys.dashboard,
  queryFn: () => repository.getDashboard(),
})

const transactionsOptions = queryOptions({
  queryKey: dataQueryKeys.transactions,
  queryFn: () => repository.getTransactions(),
})

const categoriesOptions = queryOptions({
  queryKey: dataQueryKeys.categories,
  queryFn: () => repository.getCategories(),
  staleTime: 2 * 60_000,
})

const budgetsOptions = queryOptions({
  queryKey: dataQueryKeys.budgets,
  queryFn: () => repository.getBudgets(),
})

export const gameSummaryQueryOptions = queryOptions({
  queryKey: dataQueryKeys.gameSummary,
  queryFn: () => repository.getGameSummary(),
})

export const cyberdeckQueryOptions = queryOptions({
  queryKey: dataQueryKeys.cyberdeck,
  queryFn: () => repository.getCyberdeck(),
})

export const storeOffersQueryOptions = queryOptions({
  queryKey: dataQueryKeys.storeOffers,
  queryFn: () => repository.getStoreOffers(),
  staleTime: 60_000,
})

export const gameHistoryQueryOptions = queryOptions({
  queryKey: dataQueryKeys.gameHistory,
  queryFn: () => repository.getGameHistory(),
})

export const familyBonusesQueryOptions = queryOptions({
  queryKey: dataQueryKeys.familyBonuses,
  queryFn: () => repository.getFamilyBonuses(),
})

export function useProfileQuery(initialData?: UserProfile) {
  return useQuery({ ...profileOptions, initialData })
}

export function useDashboardQuery() {
  return useQuery(dashboardQueryOptions)
}

export function useTransactionsQuery() {
  return useQuery(transactionsOptions)
}

export function useCategoriesQuery() {
  return useQuery(categoriesOptions)
}

export function useBudgetsQuery() {
  return useQuery(budgetsOptions)
}

export function useBudgetPeriodsQuery(budgetId: string | null, enabled = true) {
  return useQuery({
    queryKey: dataQueryKeys.budgetPeriods(budgetId ?? 'none'),
    queryFn: () => budgetId ? repository.getBudgetPeriods(budgetId) : Promise.resolve([]),
    enabled: enabled && Boolean(budgetId),
  })
}

export function useGameSummaryQuery(enabled = true) {
  return useQuery({ ...gameSummaryQueryOptions, enabled })
}

export function useCyberdeckQuery(enabled = true) {
  return useQuery({ ...cyberdeckQueryOptions, enabled })
}

export function useStoreOffersQuery(enabled = true) {
  const queryClient = useQueryClient()
  const query = useQuery({
    ...storeOffersQueryOptions,
    enabled,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
  const offerExpiry = query.data
    ?.map((offer) => Date.parse(offer.expiresAt))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0]

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    let timer = 0
    const schedule = () => {
      const now = Date.now()
      const weeklyBoundary = nextStoreRotationAt(new Date(now)).getTime()
      const serverBoundary = offerExpiry && offerExpiry > now ? offerExpiry : Number.POSITIVE_INFINITY
      const delay = Math.max(50, Math.min(weeklyBoundary, serverBoundary) - now + 50)
      timer = window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: dataQueryKeys.storeOffers, refetchType: 'active' })
        if (!disposed) schedule()
      }, delay)
    }
    schedule()
    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [enabled, offerExpiry, queryClient])

  return query
}

export function nextStoreRotationAt(from = new Date()) {
  const boundary = new Date(from)
  const daysUntilSunday = (7 - boundary.getUTCDay()) % 7
  boundary.setUTCDate(boundary.getUTCDate() + daysUntilSunday)
  boundary.setUTCHours(2, 0, 0, 0)
  if (boundary.getTime() <= from.getTime()) boundary.setUTCDate(boundary.getUTCDate() + 7)
  return boundary
}

export function useGameHistoryQuery(enabled = true) {
  return useQuery({ ...gameHistoryQueryOptions, enabled })
}

export function useFamilyBonusesQuery(enabled = true) {
  return useQuery({ ...familyBonusesQueryOptions, enabled })
}
