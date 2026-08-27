import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const frontendRoot = fileURLToPath(new URL('..', import.meta.url))
const distRoot = `${frontendRoot}/dist`
const assetsRoot = `${distRoot}/assets`
const html = readFileSync(`${distRoot}/index.html`, 'utf8')
const assets = readdirSync(assetsRoot).filter((name) => name.endsWith('.js'))

const deferredAreas = {
  protected: 'ProtectedLayout-',
  finance: 'FinancialPages-',
  account: 'AccountPages-',
  cyberdeck: 'GamePage-',
  store: 'GameStorePanel-',
}

const missing = Object.entries(deferredAreas).filter(([, prefix]) => !assets.some((asset) => asset.startsWith(prefix)))
if (missing.length > 0) {
  throw new Error(`Missing deferred chunks: ${missing.map(([area]) => area).join(', ')}`)
}

const prematurelyLoaded = Object.entries(deferredAreas).filter(([, prefix]) => html.includes(prefix))
if (prematurelyLoaded.length > 0) {
  throw new Error(`Deferred chunks referenced by the initial HTML: ${prematurelyLoaded.map(([area]) => area).join(', ')}`)
}

const rows = Object.entries(deferredAreas).map(([area, prefix]) => {
  const asset = assets.find((candidate) => candidate.startsWith(prefix))
  const source = readFileSync(`${assetsRoot}/${asset}`)
  return {
    area,
    asset,
    minifiedKb: (statSync(`${assetsRoot}/${asset}`).size / 1000).toFixed(2),
    gzipKb: (gzipSync(source).byteLength / 1000).toFixed(2),
  }
})

console.table(rows)
console.log('Code-splitting contract verified: feature chunks are emitted and absent from the initial HTML.')
