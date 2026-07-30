import { describe, expect, test } from 'vitest'
import { buildProdDemoFixture, PROD_DEMO_EMAIL } from '../src/scripts/prodDemoFixture.js'
import { parseResetArgs, parseTestUserNfo } from '../src/scripts/resetProdDemoUser.js'

describe('production demo reset safety', () => {
  test('only accepts dry-run or the exact demo-user confirmation', () => {
    expect(parseResetArgs(['--dry-run'])).toEqual({ mode: 'dry-run' })
    expect(parseResetArgs(['--confirm', PROD_DEMO_EMAIL])).toEqual({ mode: 'apply' })
    expect(parseResetArgs(['confirm', PROD_DEMO_EMAIL])).toEqual({ mode: 'apply' })
    expect(parseResetArgs(['--help'])).toEqual({ mode: 'help' })
    expect(() => parseResetArgs([])).toThrow('Argumentos no válidos')
    expect(() => parseResetArgs(['--confirm', 'another-user@example.com'])).toThrow('Argumentos no válidos')
    expect(() => parseResetArgs(['--confirm', PROD_DEMO_EMAIL, '--extra'])).toThrow('Argumentos no válidos')
  })

  test('uses the credentials file email as the exact confirmation value', () => {
    const credentials = parseTestUserNfo('\nNomada@BudgetRunner.local\nNeonRunner!2026\n')
    expect(credentials).toEqual({
      email: 'nomada@budgetrunner.local',
      password: 'NeonRunner!2026',
    })
    expect(parseResetArgs(['--confirm', credentials.email], credentials.email)).toEqual({ mode: 'apply' })
    expect(parseResetArgs(['confirm', credentials.email], credentials.email)).toEqual({ mode: 'apply' })
    expect(() => parseResetArgs(['--confirm', PROD_DEMO_EMAIL], 'future-demo@budgetrunner.local')).toThrow(
      'Argumentos no válidos',
    )
  })

  test('rejects malformed credential files before any maintenance can run', () => {
    expect(() => parseTestUserNfo('not-an-email\nNeonRunner!2026')).toThrow('email válido')
    expect(() => parseTestUserNfo('nomada@budgetrunner.local\nshort')).toThrow('contraseña Firebase válida')
    expect(() => parseTestUserNfo('')).toThrow('email válido')
  })
})

describe('production demo fixture', () => {
  const now = new Date('2026-08-30T10:00:00.000Z')
  const fixture = buildProdDemoFixture(now)

  test('contains the complete live-supported mock dataset', () => {
    expect(fixture.categories).toHaveLength(8)
    expect(fixture.transactions).toHaveLength(12)
    expect(fixture.budgets).toHaveLength(5)
    expect(fixture.modules).toHaveLength(9)
    expect(fixture.offers).toHaveLength(6)
    expect(fixture.definitions).toHaveLength(15)
    expect(fixture.targetProgress).toMatchObject({ level: 24, synthcoins: 2380, weeklyStreak: 7, monthlyStreak: 3 })
  })

  test('keeps the main financial totals and budget samples consistent', () => {
    const posted = fixture.transactions.filter((transaction) => transaction.status === 'posted')
    const income = posted.filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0)
    const expenses = posted.filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0)
    expect(income).toBe(348500)
    expect(expenses).toBe(132189)
    expect(income - expenses).toBe(216311)

    const transactionAmounts = new Map(fixture.transactions.map((transaction) => [transaction.id, transaction.amountMinor]))
    for (const budget of fixture.budgets.filter((item) => item.transactionIds.length > 0)) {
      const counted = budget.transactionIds.reduce((sum, id) => sum + (transactionAmounts.get(id) ?? 0), 0)
      expect(counted).toBe(budget.spendMinor)
    }
    const globalBudget = fixture.budgets.find((budget) => budget.scope === 'global')
    expect(globalBudget).toMatchObject({
      spendMinor: 132189,
      surplusMinor: 92811,
      eligibleSurplusMinor: 88151,
      excludedRewardMinor: 4660,
    })
  })

  test('re-anchors time-sensitive data so the live demo remains usable', () => {
    expect(new Date(fixture.rotation.endsAt).getTime() - now.getTime()).toBe(5 * 86_400_000)
    expect(fixture.offers.every((offer) => new Date(offer.expiresAt).getTime() > now.getTime())).toBe(true)
    const scheduled = fixture.transactions.find((transaction) => transaction.status === 'scheduled')
    expect(scheduled).toBeDefined()
    expect(new Date(scheduled?.occurredAt ?? 0).getTime()).toBeGreaterThan(now.getTime())
  })

  test('uses unique deterministic identifiers for user-owned records', () => {
    const ids = [
      ...fixture.categories.map((item) => item.id),
      ...fixture.transactions.map((item) => item.id),
      ...fixture.budgets.flatMap((item) => [item.id, item.periodId]),
      ...fixture.modules.map((item) => item.id),
      fixture.rotation.id,
      ...fixture.offers.map((item) => item.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))).toBe(true)
  })
})
