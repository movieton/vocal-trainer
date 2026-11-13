import { describe, expect, it } from 'vitest'
import { buildDayPlan } from '../dayPlan'
import type { Goal } from '../store'

describe('buildDayPlan', () => {
  it('falls back to legacyGoal when goals array is absent or invalid', () => {
    const res = buildDayPlan({
      log: [],
      goals: null,
      legacyGoal: 'ear',
      minutes: 10,
      dayNumber: 0,
      todayStr: '2026-11-14',
    })
    expect(res.goals).toEqual(['ear'])
    expect(res.steps.length).toBeGreaterThanOrEqual(2)
    expect(res.steps.some(s => s.domain === 'ear')).toBe(true)
  })

  it('generates dedicated steps for each single goal across durations', () => {
    const goals: Goal[] = ['pitch', 'range', 'ear', 'breath', 'write']
    for (const g of goals) {
      const s5 = buildDayPlan({ log: [], goals: [g], minutes: 5, dayNumber: 1, todayStr: '2026-11-14' })
      const s15 = buildDayPlan({ log: [], goals: [g], minutes: 15, dayNumber: 1, todayStr: '2026-11-14' })
      expect(s5.steps.length).toBeGreaterThanOrEqual(2)
      expect(s15.steps.length).toBeGreaterThanOrEqual(s5.steps.length)
      expect(new Set(s15.steps.map(x => x.to)).size).toBe(s15.steps.length)
    }
  })

  it('protects beginners from overload in mix mode (<= 3 gentle steps, no heavy belt/dictation)', () => {
    const res = buildDayPlan({
      log: [],
      goals: ['pitch', 'range', 'ear', 'breath', 'write'],
      minutes: 15,
      skillProfile: { ear: 'none', vocal: 'none' },
      planMode: 'mix',
      dayNumber: 1,
      todayStr: '2026-11-14',
    })
    expect(res.overloadProtected).toBe(true)
    expect(res.steps.length).toBeLessThanOrEqual(3)
    expect(res.steps.some(s => s.to.includes('/ex/ey'))).toBe(false)
    expect(res.steps.some(s => s.to.includes('/dictation'))).toBe(false)
  })

  it('combines multiple domains with tags for experienced users in mix mode', () => {
    const res = buildDayPlan({
      log: [],
      goals: ['pitch', 'ear', 'breath'],
      minutes: 15,
      skillProfile: { ear: 'base', vocal: 'base' },
      planMode: 'mix',
      dayNumber: 2,
      todayStr: '2026-11-14',
    })
    expect(res.overloadProtected).toBe(false)
    expect(res.steps.length).toBeGreaterThanOrEqual(3)
    const domains = new Set(res.steps.map(s => s.domain))
    expect(domains.has('vocal')).toBe(true)
    expect(domains.has('ear')).toBe(true)
    expect(domains.has('breath')).toBe(true)
  })

  it('rotates focusGoal across days in split mode and honors manual planFocus override', () => {
    const d0 = buildDayPlan({
      log: [],
      goals: ['pitch', 'ear', 'range'],
      minutes: 10,
      planMode: 'split',
      dayNumber: 0,
      todayStr: '2026-11-14',
    })
    const d1 = buildDayPlan({
      log: [],
      goals: ['pitch', 'ear', 'range'],
      minutes: 10,
      planMode: 'split',
      dayNumber: 1,
      todayStr: '2026-11-14',
    })
    const d2 = buildDayPlan({
      log: [],
      goals: ['pitch', 'ear', 'range'],
      minutes: 10,
      planMode: 'split',
      dayNumber: 2,
      todayStr: '2026-11-14',
    })
    expect([d0.focusGoal, d1.focusGoal, d2.focusGoal]).toEqual(['pitch', 'ear', 'range'])

    const overridden = buildDayPlan({
      log: [],
      goals: ['pitch', 'ear', 'range'],
      minutes: 10,
      planMode: 'split',
      dayNumber: 0,
      todayStr: '2026-11-14',
      planFocus: { day: '2026-11-14', goal: 'range' },
    })
    expect(overridden.focusGoal).toBe('range')
    expect(overridden.steps.some(s => s.domain === 'range')).toBe(true)

    const staleOverride = buildDayPlan({
      log: [],
      goals: ['pitch', 'ear', 'range'],
      minutes: 10,
      planMode: 'split',
      dayNumber: 0,
      todayStr: '2026-11-15',
      planFocus: { day: '2026-11-14', goal: 'range' },
    })
    expect(staleOverride.focusGoal).toBe('pitch')
  })
})
