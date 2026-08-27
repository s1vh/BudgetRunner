import { readFile } from 'node:fs/promises'

const projectRoot = new URL('../', import.meta.url)
const localValue = (await readFile(
  new URL('.secrets/prod-demo-database-url.txt', projectRoot),
  'utf8',
)).trim()
const vercelValue = process.env.DATABASE_URL?.trim()

if (!vercelValue) {
  throw new Error(
    'DATABASE_URL no está disponible para el proceso local. La variable puede faltar '
    + 'o estar marcada como Sensitive, en cuyo caso Vercel no permite volver a leerla. '
    + 'Comprueba su presencia con `vercel env ls production`; si es Sensitive, valida '
    + 'el destino al establecerla o rotarla y mediante los smoke tests del deployment.',
  )
}
if (vercelValue === '[SENSITIVE]') {
  throw new Error('DATABASE_URL está redactada porque es Sensitive y no puede compararse localmente.')
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
