import app from './app.js'
import { config } from './config.js'
import { closeDatabase } from './db.js'

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`Budget Runner API listening on http://127.0.0.1:${config.port}`)
})

async function shutdown(signal: string) {
  console.log(`${signal} received; closing API.`)
  server.close(async () => {
    await closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', () => { void shutdown('SIGINT') })
process.on('SIGTERM', () => { void shutdown('SIGTERM') })
