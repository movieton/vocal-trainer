import { describe, expect, it } from 'vitest'
import { collectLanguageTags, primarySubtag, resolveLang } from '../i18n'

describe('resolveLang', () => {
  it('keeps an explicit ru or en choice over the browser', () => {
    expect(resolveLang('en', ['ru-RU', 'ru'], 'ru-RU')).toBe('en')
    expect(resolveLang('ru', ['en-US'], 'en-US')).toBe('ru')
    expect(resolveLang('fr', ['en-US'], 'en-US')).toBe('en')
  })

  it('picks Russian when any tag is ru* and English otherwise', () => {
    expect(resolveLang(null, ['ru-RU', 'en-US'], 'ru-RU')).toBe('ru')
    expect(resolveLang(null, ['ru'], 'en-US')).toBe('ru')
    expect(resolveLang(null, ['en-US', 'ru'], 'en-US')).toBe('ru')
    expect(resolveLang(null, ['en-US', 'en'], 'en-US')).toBe('en')
    expect(resolveLang(null, ['fr-FR', 'de'], 'fr')).toBe('en')
    expect(resolveLang(null, [], '')).toBe('en')
    expect(resolveLang(null, undefined, undefined)).toBe('en')
  })

  it('still sees Russian when navigator.language is ru but languages is English-only', () => {
    expect(resolveLang(null, ['en-US'], 'ru-RU')).toBe('ru')
    expect(resolveLang(null, ['en-GB', 'en'], 'ru')).toBe('ru')
  })

  it('reads ru from ru_RU, array-like lists and comma-separated strings', () => {
    expect(primarySubtag(' RU_ru ')).toBe('ru')
    expect(primarySubtag('en-US')).toBe('en')
    const list = { 0: 'ru-RU', 1: 'en-US', length: 2 }
    expect(collectLanguageTags(list, 'en-US')).toEqual(['ru-RU', 'en-US', 'en-US'])
    expect(resolveLang(null, list, 'en-US')).toBe('ru')
    expect(resolveLang(null, 'en-US, ru-RU', 'en-US')).toBe('ru')
    expect(resolveLang(null, ['uk-UA', 'en'], 'en')).toBe('ru')
  })
})
