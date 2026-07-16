import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { closeDatabase, pool } from '../db.js'

const migrationsDirectory = resolve(process.cwd(), 'migrations')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await client.query('SELECT pg_advisory_lock(73420981)')
    const applied = new Set((await client.query<{ name: string }>('SELECT name FROM _migrations')).rows.map((row) => row.name))
    const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort()
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await readFile(resolve(migrationsDirectory, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`Applied migration ${file}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
    await client.query('SELECT pg_advisory_unlock(73420981)')
    console.log('Database migrations are up to date.')
  } finally {
    client.release()
    await closeDatabase()
  }
}

migrate().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
