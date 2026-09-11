import { describe, expect, test } from 'vitest'
import { validServiceSecret } from '../src/internalAuth.js'

describe('internal service credentials', () => {
  const expected = 'weekly-jobs-secret-2026'

  test('accepts only the complete configured secret', () => {
    expect(validServiceSecret(expected, expected)).toBe(true)
    expect(validServiceSecret(`${expected}x`, expected)).toBe(false)
    expect(validServiceSecret(expected.slice(0, -1), expected)).toBe(false)
    expect(validServiceSecret('short', 'short')).toBe(false)
  })

  test('rejects equal-code-unit Unicode credentials without throwing on byte length', () => {
    const unicode = 'é'.repeat(expected.length)
    expect(unicode).toHaveLength(expected.length)
    expect(() => validServiceSecret(unicode, expected)).not.toThrow()
    expect(validServiceSecret(unicode, expected)).toBe(false)
  })
})
