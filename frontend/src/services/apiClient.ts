import { firebaseIdToken } from '@/firebase'
import { apiErrorMessage } from '@/i18n/apiErrors'
import { catalogs } from '@/i18n/messages'
import { getRuntimeLocale } from '@/i18n/locales'
import { containsQueryShapedValue } from '@/security/textInputGuard'
import { registerSecurityCachePurge, securityResetInProgress, triggerSecurityReset } from '@/security/securityReset'
import { recordApiRequest } from '@/services/apiRequestMetrics'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

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
  private activeRequests = new Set<AbortController>()

  constructor() {
    registerSecurityCachePurge(() => {
      this.activeRequests.forEach((controller) => controller.abort())
      this.activeRequests.clear()
    })
  }

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body) as unknown
        if (containsQueryShapedValue(body)) {
          triggerSecurityReset()
          throw new ApiClientError(422, 'TRANSMISSION_REJECTED', apiErrorMessage('TRANSMISSION_REJECTED'))
        }
      } catch (error) {
        if (error instanceof ApiClientError) throw error
      }
    }

    const startedAt = performance.now()
    let responseStatus = 0
    const headers = new Headers(init.headers)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    const token = await firebaseIdToken()
    if (token) headers.set('authorization', `Bearer ${token}`)

    const controller = new AbortController()
    this.activeRequests.add(controller)
    const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, { ...init, headers, credentials: 'include', signal })
      responseStatus = response.status
    } catch {
      recordApiRequest(init.method ?? 'GET', path, startedAt, responseStatus)
      this.activeRequests.delete(controller)
      if (securityResetInProgress()) throw new ApiClientError(422, 'TRANSMISSION_REJECTED', apiErrorMessage('TRANSMISSION_REJECTED'))
      throw unreachableError()
    }

    try {
      if (response.status === 401 && retry && !path.startsWith('/auth/')) {
        if (await firebaseIdToken(true)) return this.request<T>(path, init, false)
      }
      if (response.status === 204) return undefined as T
      const payload = await readPayload<T>(response)
      if (!payload) {
        if (response.ok) return undefined as T
        throw new ApiClientError(response.status, 'EMPTY_API_RESPONSE', `${apiErrorMessage('EMPTY_API_RESPONSE')} (HTTP ${response.status})`)
      }
      if (!response.ok || payload.error) {
        const code = payload.error?.code ?? 'HTTP_ERROR'
        if (code === 'TRANSMISSION_REJECTED') triggerSecurityReset()
        throw new ApiClientError(response.status, code, apiErrorMessage(code), payload.error?.details)
      }
      return payload.data as T
    } finally {
      this.activeRequests.delete(controller)
      recordApiRequest(init.method ?? 'GET', path, startedAt, responseStatus)
    }
  }
}

export const apiClient = new ApiClient()

export function idempotencyHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID() }
}
