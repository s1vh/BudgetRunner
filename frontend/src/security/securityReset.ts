import { clearProfileBootstrap } from '@/services/profileBootstrap'
import { containsQueryShapedValue } from './textInputGuard'

const noticeKey = 'budget-runner.transmission-recovery'
const purgeCallbacks = new Set<() => void>()
let resetStarted = false

export function registerSecurityCachePurge(callback: () => void) {
  purgeCallbacks.add(callback)
  return () => { purgeCallbacks.delete(callback) }
}

export function hasSecurityResetNotice() {
  return window.sessionStorage.getItem(noticeKey) === '1'
}

export function consumeSecurityResetNotice() {
  window.sessionStorage.removeItem(noticeKey)
}

export function securityResetInProgress() {
  return resetStarted
}

export function triggerSecurityReset() {
  if (resetStarted) return
  resetStarted = true
  window.sessionStorage.setItem(noticeKey, '1')
  clearProfileBootstrap()
  purgeCallbacks.forEach((callback) => {
    try { callback() } catch { /* Continue with the remaining purge layers. */ }
  })
  window.stop()

  const cachePurge = 'caches' in window
    ? window.caches.keys().then((keys) => Promise.all(keys.map((key) => window.caches.delete(key)))).then(() => undefined)
    : Promise.resolve()
  const deadline = new Promise<void>((resolve) => window.setTimeout(resolve, 400))
  void Promise.race([cachePurge, deadline]).finally(() => window.location.reload())
}

export function enforceSafeUserInput(value: unknown) {
  if (!containsQueryShapedValue(value)) return
  triggerSecurityReset()
  throw new Error('TRANSMISSION_REJECTED')
}
