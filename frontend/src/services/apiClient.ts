import { apiErrorMessage } from '@/i18n/apiErrors'
import { catalogs } from '@/i18n/messages'
import { getRuntimeLocale } from '@/i18n/locales'
import { recordApiRequest } from '@/services/apiRequestMetrics'

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

interface ApiPayload<T> {
  data?: T
  error?: { code: string; message: string; details?: unknown }
}

async function readPayload<T>(response: Response): Promise<ApiPayload<T> | null> {
  const body = await response.text()
  if (!body.trim()) return null
  try {
    return JSON.parse(body) as ApiPayload<T>
  } catch {
    throw new ApiClientError(
      response.status,
      'INVALID_API_RESPONSE',
      `${catalogs[getRuntimeLocale()]['error.invalidResponse']} (HTTP ${response.status})`,
    )
  }
}

function unreachableError() {
  return new ApiClientError(
    0,
    'API_UNREACHABLE',
    catalogs[getRuntimeLocale()][import.meta.env.DEV ? 'error.apiUnavailableDev' : 'error.apiUnavailable'],
  )
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
          const payload = await readPayload<{ accessToken: string }>(response)
          if (!payload?.data?.accessToken) return false
          this.setAccessToken(payload.data.accessToken)
          return true
        })
        .catch(() => false)
        .finally(() => { this.refreshing = null })
    }
    return this.refreshing
  }

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const startedAt = performance.now()
    let responseStatus = 0
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    if (this.accessToken) headers.set('authorization', `Bearer ${this.accessToken}`)
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include' })
      responseStatus = response.status
    } catch {
      recordApiRequest(init.method ?? 'GET', path, startedAt, responseStatus)
      throw unreachableError()
    }
    try {
      if (response.status === 401 && retry && !path.startsWith('/auth/')) {
        if (await this.refresh()) return this.request<T>(path, init, false)
      }
      if (response.status === 204) return undefined as T
      const payload = await readPayload<T>(response)
      if (!payload) {
        if (response.ok) return undefined as T
        throw new ApiClientError(response.status, 'EMPTY_API_RESPONSE', `${apiErrorMessage('EMPTY_API_RESPONSE')} (HTTP ${response.status})`)
      }
      if (!response.ok || payload.error) {
        const code = payload.error?.code ?? 'HTTP_ERROR'
        throw new ApiClientError(response.status, code, apiErrorMessage(code), payload.error?.details)
      }
      return payload.data as T
    } finally {
      recordApiRequest(init.method ?? 'GET', path, startedAt, responseStatus)
    }
  }
}

export const apiClient = new ApiClient()

export function idempotencyHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID() }
}
