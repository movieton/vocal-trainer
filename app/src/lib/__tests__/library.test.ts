import { describe, expect, it } from 'vitest'
import { BREATH } from '../../data/breath'
import { EXERCISES } from '../../data/exercises'
import { LIBRARY } from '../../data/library'
import libEn from '../../data/library.en.json'
import rawRu from '../../data/library.json'

describe('exercise & library data integrity', () => {
  it('has no ID collisions across EXERCISES, BREATH, and LIBRARY', () => {
    const allIds = [...EXERCISES.map(e => e.id), ...BREATH.map(b => b.id), ...LIBRARY.map(l => l.id)]
    const counts = new Map<string, number>()
    for (const id of allIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    const dupes = [...counts.entries()].filter(([, n]) => n > 1)
    expect(dupes).toEqual([])
  })

  it('renames breath-library yawn-sigh card to yawn-sigh-breath in RU and EN', () => {
    expect(rawRu.some(i => i.id === 'yawn-sigh')).toBe(false)
    expect(libEn.some(i => i.id === 'yawn-sigh')).toBe(false)
    expect(rawRu.some(i => i.id === 'yawn-sigh-breath')).toBe(true)
    expect(libEn.some(i => i.id === 'yawn-sigh-breath')).toBe(true)
  })

  it('has complete instructions, mistakes, and dose for tw-05 in RU and EN', () => {
    for (const list of [rawRu, libEn]) {
      const tw05 = list.find(i => i.id === 'tw-05')
      expect(tw05).toBeDefined()
      expect(tw05!.how.length).toBeGreaterThanOrEqual(3)
      expect(tw05!.mistakes.length).toBeGreaterThanOrEqual(2)
      expect(tw05!.dose.trim().length).toBeGreaterThan(0)
    }
  })

  it('has non-empty mistakes on every BREATH exercise', () => {
    expect(BREATH).toHaveLength(18)
    for (const b of BREATH) {
      expect(b.mistakes && b.mistakes.length > 0, `missing mistakes for ${b.id}`).toBe(true)
    }
  })
})
