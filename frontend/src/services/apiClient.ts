const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
const tokenKey = 'budget-runner-access-token'

export function apiUrl(path: string) {
  return `${baseUrl}${path}`
}

export class ApiClientError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly details: unknown = {}) {
    super(message)
  }
}

class ApiClient {
  private accessToken = window.localStorage.getItem(tokenKey)
  private refreshing: Promise<boolean> | null = null

  setAccessToken(token: string | null) {
    this.accessToken = token
    if (token) window.localStorage.setItem(tokenKey, token)
    else window.localStorage.removeItem(tokenKey)
  }

  hasAccessToken() { return Boolean(this.accessToken) }

  async refresh() {
    if (!this.refreshing) {
      this.refreshing = fetch(`${baseUrl}/auth/refresh`, { method: 'POST', credentials: 'include' })
        .then(async (response) => {
          if (!response.ok) return false
          const payload = await response.json() as { data: { accessToken: string } }
          this.setAccessToken(payload.data.accessToken)
          return true
        })
        .catch(() => false)
        .finally(() => { this.refreshing = null })
    }
    return this.refreshing
  }

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    if (this.accessToken) headers.set('authorization', `Bearer ${this.accessToken}`)
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' })
    if (response.status === 401 && retry && !path.startsWith('/auth/')) {
      if (await this.refresh()) return this.request<T>(path, init, false)
    }
    if (response.status === 204) return undefined as T
    const payload = await response.json() as { data?: T; error?: { code: string; message: string; details?: unknown } }
    if (!response.ok || payload.error) {
      throw new ApiClientError(response.status, payload.error?.code ?? 'HTTP_ERROR', payload.error?.message ?? 'No se pudo completar la petición.', payload.error?.details)
    }
    return payload.data as T
  }
}

export const apiClient = new ApiClient()

export function idempotencyHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID() }
}
