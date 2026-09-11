export type BudgetFrequency = 'weekly' | 'monthly'

interface LocalDateParts {
  year: number
  month: number
  day: number
}

const localDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u

function parseLocalDate(value: string): LocalDateParts {
  const match = localDatePattern.exec(value)
  if (!match) throw new RangeError(`Invalid local date: ${value}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError(`Invalid local date: ${value}`)
  }
  return { year, month, day }
}

function formatLocalDate(parts: LocalDateParts) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function addDays(value: string, days: number) {
  const parts = parseLocalDate(value)
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return formatLocalDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })
}

function dateForMonth(anchorDay: number, year: number, monthIndex: number) {
  const normalized = new Date(Date.UTC(year, monthIndex, 1))
  const targetYear = normalized.getUTCFullYear()
  const targetMonth = normalized.getUTCMonth() + 1
  return formatLocalDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(anchorDay, daysInMonth(targetYear, targetMonth)),
  })
}

/**
 * Returns the exclusive local-date boundary for a period. Monthly periods keep
 * the original anchor day, so Jan 31 -> Feb 28 -> Mar 31 instead of drifting.
 */
export function nextPeriodEndDate(startDate: string, frequency: BudgetFrequency, anchorDate = startDate) {
  if (frequency === 'weekly') return addDays(startDate, 7)
  const start = parseLocalDate(startDate)
  const anchor = parseLocalDate(anchorDate)
  return dateForMonth(anchor.day, start.year, start.month)
}

/**
 * Finds the first recurrence strictly after the user's current local date.
 * This is used when a paused budget is resumed after its committed period has
 * closed; skipped periods are never recreated retroactively.
 */
export function nextFuturePeriodStart(anchorDate: string, frequency: BudgetFrequency, currentLocalDate: string) {
  const anchor = parseLocalDate(anchorDate)
  const current = parseLocalDate(currentLocalDate)
  if (anchorDate > currentLocalDate) return anchorDate

  if (frequency === 'weekly') {
    const anchorTime = Date.UTC(anchor.year, anchor.month - 1, anchor.day)
    const currentTime = Date.UTC(current.year, current.month - 1, current.day)
    const elapsedDays = Math.floor((currentTime - anchorTime) / 86_400_000)
    return addDays(anchorDate, (Math.floor(elapsedDays / 7) + 1) * 7)
  }

  let monthOffset = (current.year - anchor.year) * 12 + current.month - anchor.month
  let candidate = dateForMonth(anchor.day, anchor.year, anchor.month - 1 + monthOffset)
  if (candidate < anchorDate) candidate = anchorDate
  if (candidate <= currentLocalDate) {
    monthOffset += 1
    candidate = dateForMonth(anchor.day, anchor.year, anchor.month - 1 + monthOffset)
  }
  return candidate
}

/** A frequency change starts a new recurrence anchored at the committed boundary. */
export function renewalAnchorDate(
  currentFrequency: BudgetFrequency,
  nextFrequency: BudgetFrequency,
  configuredAnchorDate: string,
  boundaryLocalDate: string,
) {
  parseLocalDate(configuredAnchorDate)
  parseLocalDate(boundaryLocalDate)
  return currentFrequency === nextFrequency ? configuredAnchorDate : boundaryLocalDate
}
