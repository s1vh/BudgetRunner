/// <reference types="vite/client" />

import type { ApiRequestMetric } from '@/services/apiRequestMetrics'

declare global {
  interface Window {
    __BUDGET_RUNNER_API_METRICS__?: ApiRequestMetric[]
  }
}
