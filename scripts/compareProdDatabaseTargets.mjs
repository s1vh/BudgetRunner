import { readFile } from 'node:fs/promises'

const projectRoot = new URL('../', import.meta.url)
const localValue = (await readFile(
  new URL('.secrets/prod-demo-database-url.txt', projectRoot),
  'utf8',
)).trim()
const vercelValue = process.env.DATABASE_URL?.trim()

if (!vercelValue || vercelValue === '[SENSITIVE]') {
  throw new Error(
    'Vercel no ha inyectado DATABASE_URL. Ejecuta este script mediante `vercel env run -e production -- ...`.',
  )
}

const localUrl = new URL(localValue)
const vercelUrl = new URL(vercelValue)

function safeTarget(url) {
  return {
    host: url.hostname,
    database: url.pathname.replace(/^\//, ''),
    pooled: url.hostname.includes('-pooler.'),
  }
}

function canonicalEndpoint(hostname) {
  return hostname.replace('-pooler.', '.')
}

const localTarget = safeTarget(localUrl)
const vercelTarget = safeTarget(vercelUrl)
const sameEndpoint = canonicalEndpoint(localTarget.host) === canonicalEndpoint(vercelTarget.host)
const sameDatabase = localTarget.database === vercelTarget.database

console.table({
  'Reset local': localTarget,
  'Vercel production': vercelTarget,
})
console.log(`Mismo endpoint Neon: ${sameEndpoint ? 'sí' : 'no'}`)
console.log(`Misma base: ${sameDatabase ? 'sí' : 'no'}`)

if (!sameEndpoint || !sameDatabase) {
  console.error('La URL local no corresponde al DATABASE_URL efectivo de producción.')
  process.exitCode = 2
} else {
  console.log('La URL direct local corresponde al destino efectivo de producción.')
}
