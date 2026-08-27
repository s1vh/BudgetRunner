import { randomUUID } from 'node:crypto'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import helmet from 'helmet'
import { config } from './config.js'
import { pool } from './db.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { authRouter, meRouter } from './routes/authRoutes.js'
import { budgetInternalRouter, budgetRouter } from './routes/budgetRoutes.js'
import { gameRouter } from './routes/gameRoutes.js'
import { transactionRouter } from './routes/transactionRoutes.js'
import { rejectQueryShapedInput } from './security/textInputGuard.js'

const createHelmetMiddleware = helmet as unknown as () => RequestHandler

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(createHelmetMiddleware())
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) callback(null, true)
      else callback(new Error('CORS origin rejected'))
    },
  }))
  app.use(express.json({ limit: '256kb' }))
  app.use(cookieParser())
  app.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.header('x-request-id')
    const requestId = incoming && /^[0-9a-f-]{36}$/i.test(incoming) ? incoming : randomUUID()
    ;(request as Request & { requestId: string }).requestId = requestId
    response.setHeader('x-request-id', requestId)
    next()
  })
  app.use(rejectQueryShapedInput)

  app.get('/api/v1/internal/health', (_request, response) => response.json({ data: { status: 'ok' }, meta: {} }))
  app.get('/api/v1/internal/readiness', async (_request, response, next) => {
    try {
      await pool.query('SELECT 1')
      response.json({ data: { status: 'ready', database: 'postgresql' }, meta: {} })
    } catch (error) { next(error) }
  })

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/me', meRouter)
  app.use('/api/v1/internal', budgetInternalRouter)
  app.use('/api/v1/game', gameRouter)
  app.use('/api/v1', budgetRouter)
  app.use('/api/v1', transactionRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

export default createApp()

