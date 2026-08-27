import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, test } from 'vitest'

const sourceRoot = join(process.cwd(), 'src')
const infrastructureExceptions = new Set([
  'db.ts',
  join('scripts', 'migrate.ts'),
])

function typescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return typescriptFiles(path)
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : []
  })
}

describe('SQL construction invariant', () => {
  test('las rutas y servicios solo ejecutan SQL estático', () => {
    const violations: string[] = []
    for (const file of typescriptFiles(sourceRoot)) {
      const localPath = relative(sourceRoot, file)
      if (infrastructureExceptions.has(localPath)) continue
      const source = readFileSync(file, 'utf8')
      const queryCall = /\.query(?:<[^;()]*?>)?\s*\(/gu
      for (const match of source.matchAll(queryCall)) {
        const argumentStart = (match.index ?? 0) + match[0].length
        const remainder = source.slice(argumentStart).trimStart()
        const delimiter = remainder[0]
        const staticLiteral = delimiter === "'" || delimiter === '"' || delimiter === '`'
        const interpolatedTemplate = delimiter === '`' && remainder.slice(1, remainder.indexOf('`', 1)).includes('${')
        if (!staticLiteral || interpolatedTemplate) {
          const line = source.slice(0, match.index).split(/\r?\n/u).length
          violations.push(`${localPath}:${line}`)
        }
      }
    }
    expect(violations, 'No interpoles ni compongas SQL en runtime; usa texto estático y parámetros $n.').toEqual([])
  })
})
