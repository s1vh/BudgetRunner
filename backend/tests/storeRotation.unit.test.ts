import { describe, expect, test } from 'vitest'
import {
  getStoreRotationWindow,
  selectStoreDefinitions,
  type StoreDefinitionCandidate,
  type StoreRarity,
} from '../src/storeRotation.js'

const ranks: Record<StoreRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
}

describe('weekly Cyberdeck store rotation', () => {
  test.each([
    ['just before the boundary', '2026-09-06T01:59:59.999Z', '2026-08-30T02:00:00.000Z', '2026-09-06T02:00:00.000Z'],
    ['at the boundary', '2026-09-06T02:00:00.000Z', '2026-09-06T02:00:00.000Z', '2026-09-13T02:00:00.000Z'],
    ['during the week', '2026-09-10T21:45:00.000Z', '2026-09-06T02:00:00.000Z', '2026-09-13T02:00:00.000Z'],
    ['across European DST', '2026-03-29T03:30:00.000Z', '2026-03-29T02:00:00.000Z', '2026-04-05T02:00:00.000Z'],
  ])('uses an exact Sunday 02:00 UTC window %s', (_label, instant, startsAt, endsAt) => {
    const window = getStoreRotationWindow(new Date(instant))
    expect(window.startsAt.toISOString()).toBe(startsAt)
    expect(window.endsAt.toISOString()).toBe(endsAt)
  })

  test('selects six distinct eligible definitions reproducibly', () => {
    const definitions: StoreDefinitionCandidate[] = Array.from({ length: 12 }, (_, index) => ({
      id: `definition-${index}`,
      rarity: index % 2 ? 'rare' : 'common',
      priceCoins: 100 + index * 25,
      minLevel: index < 9 ? 1 : 5,
    }))
    const first = selectStoreDefinitions(definitions, 1, 'persisted-seed')
    const retry = selectStoreDefinitions([...definitions].reverse(), 1, 'persisted-seed')
    expect(first).toHaveLength(6)
    expect(new Set(first.map((definition) => definition.id))).toHaveLength(6)
    expect(first.every((definition) => definition.minLevel <= 1)).toBe(true)
    expect(retry.map((definition) => definition.id)).toEqual(first.map((definition) => definition.id))
  })

  test('shifts rarity and price upward as the user level increases', () => {
    const rarities: StoreRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']
    const definitions = rarities.flatMap((rarity, rarityIndex) => Array.from({ length: 12 }, (_, index) => ({
      id: `${rarity}-${index}`,
      rarity,
      priceCoins: 100 + rarityIndex * 500 + index * 10,
      minLevel: 1,
    } satisfies StoreDefinitionCandidate)))
    const averages = (level: number) => {
      const selected = Array.from({ length: 500 }, (_, index) => (
        selectStoreDefinitions(definitions, level, `sample-${index}`)
      )).flat()
      return {
        rarity: selected.reduce((sum, definition) => sum + ranks[definition.rarity], 0) / selected.length,
        price: selected.reduce((sum, definition) => sum + definition.priceCoins, 0) / selected.length,
      }
    }
    const lowLevel = averages(1)
    const highLevel = averages(10)
    expect(highLevel.rarity).toBeGreaterThan(lowLevel.rarity + 1)
    expect(highLevel.price).toBeGreaterThan(lowLevel.price + 500)
  })

  test('fails closed when a catalog cannot supply six offers', () => {
    const definitions: StoreDefinitionCandidate[] = Array.from({ length: 5 }, (_, index) => ({
      id: `definition-${index}`,
      rarity: 'common',
      priceCoins: 100 + index,
      minLevel: 1,
    }))
    expect(() => selectStoreDefinitions(definitions, 1, 'seed')).toThrow(/5 eligible modules/)
  })
})
