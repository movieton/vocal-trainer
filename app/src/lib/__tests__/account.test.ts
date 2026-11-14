import { describe, expect, it } from 'vitest'
import { merge } from '../account'

describe('account.merge', () => {
  it('returns local snapshot untouched when remote is null', () => {
    expect(merge({ goal: 'pitch' }, null)).toEqual({ goal: 'pitch' })
  })

  it('resolves key conflicts by latest meta timestamp', () => {
    const local = {
      goal: 'ear',
      dailyMin: 10,
      meta: { goal: 2000, dailyMin: 1000 },
    }
    const remote = {
      goal: 'range',
      dailyMin: 20,
      meta: { goal: 1500, dailyMin: 2500 },
    }
    const merged = merge(local, remote)
    expect(merged.goal).toBe('ear') // local newer (2000 > 1500)
    expect(merged.dailyMin).toBe(20) // remote newer (2500 > 1000)
    expect(merged.meta).toEqual({ goal: 2000, dailyMin: 2500 })
  })

  it('deduplicates and sorts session logs descending by date', () => {
    const local = {
      log: [
        { id: 'lip-trill-5', date: 1000, score: 0.8 },
        { id: 'hum', date: 3000, score: 0.9 },
      ],
    }
    const remote = {
      log: [
        { id: 'lip-trill-5', date: 1000, score: 0.8 },
        { id: 'scale-9', date: 2000, score: 0.75 },
      ],
    }
    const merged = merge(local, remote)
    const log = merged.log as { id: string; date: number }[]
    expect(log.map(l => `${l.date}:${l.id}`)).toEqual([
      '3000:hum',
      '2000:scale-9',
      '1000:lip-trill-5',
    ])
  })

  it('unions course.done and drill.passed, merging same-day lv with max', () => {
    const local = {
      course: { done: { 1: 100 }, active: { n: 2, since: 500, visited: [] } },
      'drill.passed': { day: 'Fri Nov 13 2026', lv: { intervals: 2, chords: 1 } },
    }
    const remote = {
      course: { done: { 1: 200, 2: 300 }, active: null },
      'drill.passed': { day: 'Fri Nov 13 2026', lv: { intervals: 1, scales: 3 } },
    }
    const merged = merge(local, remote)
    expect(merged.course).toEqual({
      done: { 1: 100, 2: 300 },
      active: { n: 2, since: 500, visited: [] },
    })
    expect(merged['drill.passed']).toEqual({
      day: 'Fri Nov 13 2026',
      lv: { intervals: 2, chords: 1, scales: 3 },
    })
  })

  it('reconciles goals, legacy goal, skillProfile and planMode timestamps cleanly', () => {
    const newerLegacy = merge(
      { goal: 'breath', goals: ['pitch'], meta: { goal: 300, goals: 100 } },
      { goal: 'pitch', goals: ['pitch', 'ear'], skillProfile: { ear: 'base', vocal: 'bad' }, planMode: 'split', meta: { goal: 200, goals: 200 } },
    )
    expect(newerLegacy.goals).toEqual(['breath'])
    expect(newerLegacy.goal).toBe('breath')
    expect(newerLegacy.skillProfile).toEqual({ ear: 'base', vocal: 'none' })
    expect(newerLegacy.planMode).toBe('split')

    const newerMulti = merge(
      { goal: 'pitch', goals: ['ear', 'range'], skillProfile: { ear: 'base', vocal: 'base' }, planMode: 'mix', meta: { goal: 100, goals: 400 } },
      { goal: 'breath', goals: ['breath'], meta: { goal: 200, goals: 200 } },
    )
    expect(newerMulti.goals).toEqual(['ear', 'range'])
    expect(newerMulti.goal).toBe('ear')
  })

  it('migrates songs.mine to songs.custom and enforces 25-song cap during merge', () => {
    const legacyMine = {
      id: 'mine',
      title: 'VeryLongTitle'.repeat(10),
      sub: 'Напета',
      level: 1,
      bpm: 90,
      meter: 4,
      phrases: [{ label: 'F1', notes: [{ s: 0, d: 1 }] }],
    }
    const fromLegacy = merge({}, { 'songs.mine': legacyMine, meta: { 'songs.mine': 500 } })
    expect(Array.isArray(fromLegacy['songs.custom'])).toBe(true)
    const migrated = fromLegacy['songs.custom'] as Array<{ id: string; title: string }>
    expect(migrated).toHaveLength(1)
    expect(migrated[0].id).toBe('mine')
    expect(migrated[0].title.length).toBeLessThanOrEqual(80)

    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `c-${i}`,
      title: `Track ${i}`,
      sub: '',
      level: 1,
      bpm: 95,
      meter: 4,
      phrases: [{ label: 'P1', notes: [{ s: 0, d: 1 }] }],
    }))
    const capped = merge({ 'songs.custom': many, meta: { 'songs.custom': 900 } }, { 'songs.custom': [], meta: { 'songs.custom': 100 } })
    expect((capped['songs.custom'] as unknown[]).length).toBe(25)
  })
})
