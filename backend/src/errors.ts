import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = {},
  ) {
    super(message)
  }
}

export function asyncHandler(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (request, response, next) => {
    void Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `No existe la ruta ${request.method} ${request.path}.`))
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = String((request as Request & { requestId?: string }).requestId ?? '')

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'La petición contiene datos no válidos.',
        details: error.flatten(),
        requestId,
      },
    })
    return
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details, requestId },
    })
    return
  }

  const databaseCode = error instanceof Error && 'code' in error ? String(error.code) : ''
  if (databaseCode === '23505') {
    response.status(409).json({ error: { code: 'RESOURCE_CONFLICT', message: 'El recurso ya existe.', details: {}, requestId } })
    return
  }
  if (databaseCode === '23503') {
    response.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'La referencia indicada no es válida.', details: {}, requestId } })
    return
  }

  console.error(`[${requestId}]`, error)
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Se ha producido un error interno.', details: {}, requestId },
  })
}

