export interface ApiRequestMetric {
  method: string
  path: string
  durationMs: number
  status: number
  recordedAt: string
}

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi
const metrics = window.__BUDGET_RUNNER_API_METRICS__ ?? []
window.__BUDGET_RUNNER_API_METRICS__ = metrics

function metricPath(path: string) {
  return path.split('?')[0]!.replace(uuidPattern, ':id')
}

export function recordApiRequest(method: string, path: string, startedAt: number, status: number) {
  const endedAt = performance.now()
  const metric: ApiRequestMetric = {
    method: method.toUpperCase(),
    path: metricPath(path),
    durationMs: Math.round((endedAt - startedAt) * 10) / 10,
    status,
    recordedAt: new Date().toISOString(),
  }
  metrics.push(metric)
  if (metrics.length > 200) metrics.splice(0, metrics.length - 200)
  try {
    performance.measure(`budget-runner:api:${metric.method}:${metric.path}`, {
      start: startedAt,
      end: endedAt,
      detail: metric,
    })
  } catch {
    // Metrics must never interfere with the request they observe.
  }
}
