import { describe, expect, test } from 'vitest'
import { canonicalizeUntrustedText, containsQueryShapedText } from '../src/security/textInputGuard.js'
import { containsQueryShapedText as containsQueryShapedTextInBrowser } from '../../frontend/src/security/textInputGuard.js'

describe('text input guard', () => {
  test.each([
    "O'Brien Café",
    'Selecta Market',
    'Actualización de gastos del mes',
    'Cena con Ana -- viernes',
    'Ahorro (50 %) y ocio',
    'NeonRunner!2026',
    'nomada@budgetrunner.local',
    'Compra de mesa Drop Leaf',
  ])('permite texto legítimo: %s', (value) => {
    expect(containsQueryShapedText(value)).toBe(false)
    expect(containsQueryShapedTextInBrowser(value)).toBe(false)
  })

  test.each([
    'SELECT * FROM users',
    "nomada@budgetrunner.local' OR 1=1--",
    "x'); DROP TABLE financial_transactions;--",
    'UNION ALL SELECT password_hash FROM users',
    'SEL/**/ECT password_hash FROM users',
    'SELECT/**/password_hash/**/FROM/**/users',
    '%53%45%4c%45%43%54%20*%20%46%52%4f%4d%20users',
    'ＳＥＬＥＣＴ * ＦＲＯＭ users',
    'WITH stolen AS (SELECT * FROM users) SELECT * FROM stolen',
    "1' AND pg_sleep(5)--",
    '1 OR 1=1',
    "UN'||'ION SEL'||'ECT password_hash FROM users",
    'SELECT CHR(112)||CHR(103) FROM users',
    'SELECT * FROM information_schema.tables',
  ])('rechaza una secuencia con forma de consulta: %s', (value) => {
    expect(containsQueryShapedText(value)).toBe(true)
    expect(containsQueryShapedTextInBrowser(value)).toBe(true)
  })

  test('normaliza codificación, Unicode invisible y comentarios', () => {
    expect(canonicalizeUntrustedText('ＳＥ\u200bＬ/**/ＥＣＴ')).toBe('select')
  })
})
