import { queryOptions, useQuery } from '@tanstack/react-query'
import { repository } from '@/services/repository'
import type { UserProfile } from '@/types/domain'

export const dataQueryKeys = {
  profile: ['app-data', 'profile'] as const,
  dashboard: ['app-data', 'dashboard'] as const,
  transactions: ['app-data', 'transactions'] as const,
  categories: ['app-data', 'categories'] as const,
  budgets: ['app-data', 'budgets'] as const,
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

export function useGameSummaryQuery(enabled = true) {
  return useQuery({ ...gameSummaryQueryOptions, enabled })
}

export function useCyberdeckQuery(enabled = true) {
  return useQuery({ ...cyberdeckQueryOptions, enabled })
}

export function useStoreOffersQuery(enabled = true) {
  return useQuery({ ...storeOffersQueryOptions, enabled })
}

export function useGameHistoryQuery(enabled = true) {
  return useQuery({ ...gameHistoryQueryOptions, enabled })
}

export function useFamilyBonusesQuery(enabled = true) {
  return useQuery({ ...familyBonusesQueryOptions, enabled })
}
