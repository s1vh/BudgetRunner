import { describe, expect, test } from 'vitest'
import {
  nextFuturePeriodStart,
  nextPeriodEndDate,
  renewalAnchorDate,
} from '../src/budgetCalendar.js'

describe('budget calendar', () => {
  test('weekly periods advance by seven local calendar days', () => {
    expect(nextPeriodEndDate('2026-12-29', 'weekly')).toBe('2027-01-05')
  })

  test('monthly periods retain their anchor after a short month', () => {
    const february = nextPeriodEndDate('2027-01-31', 'monthly', '2027-01-31')
    const march = nextPeriodEndDate(february, 'monthly', '2027-01-31')
    expect(february).toBe('2027-02-28')
    expect(march).toBe('2027-03-31')
    expect(nextPeriodEndDate('2028-01-31', 'monthly', '2028-01-31')).toBe('2028-02-29')
  })

  test('resume skips elapsed periods and selects the next future boundary', () => {
    expect(nextFuturePeriodStart('2026-09-01', 'weekly', '2026-09-10')).toBe('2026-09-15')
    expect(nextFuturePeriodStart('2026-01-31', 'monthly', '2026-02-28')).toBe('2026-03-31')
    expect(nextFuturePeriodStart('2026-10-15', 'monthly', '2026-09-10')).toBe('2026-10-15')
  })

  test('a frequency change re-anchors at the committed period boundary', () => {
    const transitionBoundary = '2026-09-17'
    const anchor = renewalAnchorDate('weekly', 'monthly', '2026-09-10', transitionBoundary)
    expect(anchor).toBe(transitionBoundary)
    expect(nextPeriodEndDate(transitionBoundary, 'monthly', anchor)).toBe('2026-10-17')
    expect(renewalAnchorDate('monthly', 'monthly', '2026-01-31', '2026-02-28')).toBe('2026-01-31')
  })

  test('rejects impossible calendar dates', () => {
    expect(() => nextPeriodEndDate('2026-02-30', 'weekly')).toThrow(RangeError)
  })
})
