import pg, { type QueryResult, type QueryResultRow } from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: true,
  statement_timeout: 10_000,
  query_timeout: 12_000,
  lock_timeout: 5_000,
  idle_in_transaction_session_timeout: 10_000,
})

export interface DbClient {
  query<Row extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
}

export async function withTransaction<T>(operation: (client: DbClient) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
      let queryQueue = Promise.resolve()
      const serializedClient: DbClient = {
        query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
          const scheduled = queryQueue.then(() => client.query<Row>(text, values))
          queryQueue = scheduled.then(() => undefined, () => undefined)
          return scheduled
        },
      }
      const result = await operation(serializedClient)
      await queryQueue
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      const code = error instanceof Error && 'code' in error ? String(error.code) : ''
      if (code === '40001' && attempt < attempts) continue
      throw error
    } finally {
      client.release()
    }
  }
  throw new Error('Transaction retry budget exhausted')
}

export async function closeDatabase() {
  await pool.end()
}
