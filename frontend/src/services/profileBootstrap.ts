import type { UserProfile } from '@/types/domain'

let restoredProfile: UserProfile | null = null

export function primeProfileBootstrap(profile: UserProfile) {
  restoredProfile = structuredClone(profile)
}

export function readProfileBootstrap() {
  return restoredProfile ? structuredClone(restoredProfile) : undefined
}

export function clearProfileBootstrap() {
  restoredProfile = null
}
