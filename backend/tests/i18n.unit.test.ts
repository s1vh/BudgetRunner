import { describe, expect, test } from 'vitest'
import { catalogs, translationKeys } from '../../frontend/src/i18n/messages.ts'
import { defaultLocale, resolveLocale, supportedLocales } from '../../frontend/src/i18n/locales.ts'
import { systemCategoryKey } from '../src/systemCategories.js'

describe('internationalization contracts', () => {
  test('resolves supported system locales and falls back to English', () => {
    expect(resolveLocale('es-MX')).toBe('es-ES')
    expect(resolveLocale('en-GB')).toBe('en-US')
    expect(resolveLocale('zh-Hans-SG')).toBe('zh-CN')
    expect(resolveLocale('ja')).toBe('ja-JP')
    expect(resolveLocale('it-IT')).toBe(defaultLocale)
    expect(resolveLocale('zh-TW')).toBe(defaultLocale)
  })

  test('keeps every catalog complete and non-empty', () => {
    for (const locale of supportedLocales) {
      expect(Object.keys(catalogs[locale])).toHaveLength(translationKeys.length)
      for (const key of translationKeys) expect(catalogs[locale][key].trim()).not.toBe('')
    }
  })

  test('preserves product and game proper names in every language', () => {
    for (const locale of supportedLocales) {
      expect(catalogs[locale]['app.description']).toContain('Budget Runner')
      expect(catalogs[locale]['profile.totalFlux']).toContain('Flux')
      expect(catalogs[locale]['error.insufficientCoins']).toContain('SynthCoins')
      expect(catalogs[locale]['game.tab.deck']).toContain('Cyberdeck')
      expect(catalogs[locale]['help.game.totalFlux']).toContain('Flux')
      expect(catalogs[locale]['help.game.totalFlux']).toContain('Power')
      expect(catalogs[locale]['help.game.synthcoins']).toContain('SynthCoins')
      expect(catalogs[locale]['help.game.cyberdeck']).toContain('Cyberdeck')
      expect(catalogs[locale]['tour.game.flux.body']).toContain('Flux')
      expect(catalogs[locale]['tour.game.flux.body']).toContain('Power')
      expect(catalogs[locale]['tour.game.cyberdeck.body']).toContain('Power')
      expect(catalogs[locale]['tour.game.cyberdeck.body']).toContain('Shield')
      expect(catalogs[locale]['tour.game.cyberdeck.body']).toContain('Energy')
    }
  })

  test('only assigns translation keys to seeded categories', () => {
    expect(systemCategoryKey('fuel', true)).toBe('systemCategory.fuel')
    expect(systemCategoryKey('fuel', false)).toBeUndefined()
    expect(systemCategoryKey('custom-icon', true)).toBeUndefined()
  })
})
