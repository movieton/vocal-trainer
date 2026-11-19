import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Exercise } from '../../data/exercises'
import { exerciseById } from '../../data/exercises'
import { libExercise } from '../../data/library'
import { engine } from '../audio'
import { buildRoots, ExerciseRun, fitExercise, targetAt } from '../run'

const sampleEx: Exercise = {
  id: 'test-triad',
  title: 'Test triad',
  section: 'warmup',
  level: 1,
  syllable: 'ма',
  goal: 'test',
  bpm: 120, // beat = 0.5s
  notes: [
    { s: 0, d: 1, syl: 'ма' },
    { s: 4, d: 1, syl: 'ме' },
    { s: 7, d: 2, syl: 'мо' },
  ],
}

describe('run helpers & ExerciseRun', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    engine.history = []
    engine.latency = 0
  })

  it('interpolates glissando targets via targetAt', () => {
    const g = { midi: 60, midiEnd: 72, t0: 10, t1: 12, sing: true, rep: 0 }
    expect(targetAt(g, 9)).toBe(60)
    expect(targetAt(g, 10)).toBe(60)
    expect(targetAt(g, 11)).toBe(66)
    expect(targetAt(g, 12)).toBe(72)
    expect(targetAt(g, 15)).toBe(72)
  })

  it('builds ascending + descending roots in auto key and 6 fixed roots when key is pinned', () => {
    const autoRoots = buildRoots(sampleEx, { lo: 48, hi: 60 }, 0, 'auto')
    // span is 0..7; lo+1-0=49 .. hi-1-7=52 => [49, 50, 51, 52, 51, 50, 49]
    expect(autoRoots).toEqual([49, 50, 51, 52, 51, 50, 49])

    const fixedRoots = buildRoots(sampleEx, { lo: 48, hi: 64 }, 0, 0)
    expect(fixedRoots).toHaveLength(6)
    expect(new Set(fixedRoots).size).toBe(1)
  })

  it('scores a rep accurately when ExerciseRun transitions through phases', () => {
    vi.spyOn(engine, 'ensureCtx').mockReturnValue({ currentTime: 0 } as unknown as AudioContext)
    vi.spyOn(engine, 'play').mockImplementation(() => {})
    vi.spyOn(engine, 'ref').mockImplementation(() => {})
    vi.spyOn(engine, 'stopAll').mockImplementation(() => {})

    const run = new ExerciseRun(sampleEx, {
      range: { lo: 50, hi: 64 },
      mode: 'together',
      tempo: 1,
      tolerance: 25,
      shift: 0,
      key: 0, // fixed root near center
    })
    run.start()
    // repStart = 0.4, beat = 0.5 => listenStart/End = 1.4, singStart = 1.4
    // notes: [1.4..1.9], [1.9..2.4], [2.4..3.4]; singEnd = 3.4
    expect(run.update(0.5)).toBe(true)
    expect(run.phase).toBe('cue')

    expect(run.update(1.5)).toBe(true)
    expect(run.phase).toBe('sing')

    // Populate accurate pitch history covering all 3 notes
    const root = run.root
    for (let t = 1.4; t < 3.4; t += 0.02) {
      const m = t < 1.9 ? root : t < 2.4 ? root + 4 : root + 7
      engine.history.push({ t, midi: m })
    }

    // Trigger rep completion (> singEnd + 0.3)
    expect(run.update(3.8)).toBe(true)
    expect(run.results).toHaveLength(1)
    expect(run.results[0].score).toBeCloseTo(1, 5)
    expect(run.seq).toBe(1)
    expect(run.rep).toBe(1)

    const sum = run.summary()
    expect(sum.reps).toBe(1)
    expect(sum.score).toBeCloseTo(1, 5)
    expect(sum.drift).toEqual([])
    expect(sum.voiced).toBeGreaterThanOrEqual(4)
    run.stop()
  })

  it('counts a silent rep as zero voiced frames', () => {
    vi.spyOn(engine, 'ensureCtx').mockReturnValue({ currentTime: 0 } as unknown as AudioContext)
    vi.spyOn(engine, 'play').mockImplementation(() => {})
    vi.spyOn(engine, 'ref').mockImplementation(() => {})
    vi.spyOn(engine, 'stopAll').mockImplementation(() => {})

    const run = new ExerciseRun(sampleEx, {
      range: { lo: 50, hi: 64 },
      mode: 'together',
      tempo: 1,
      tolerance: 25,
      shift: 0,
      key: 0,
    })
    run.start()
    expect(run.update(3.8)).toBe(true)
    expect(run.results[0].score).toBe(0)
    expect(run.results[0].notes.every(n => n.cents == null && n.voiced === 0)).toBe(true)
    expect(run.summary().voiced).toBe(0)
    run.stop()
  })

  it('compresses 2-octave exercises to fit a narrow workRange while preserving contour', () => {
    const narrow = { lo: 50, hi: 60 }
    for (const id of ['siren-full', 'vfe-stretch', 'vfe-contract']) {
      const ex = exerciseById(id) ?? libExercise(id)
      expect(ex).toBeDefined()
      const fitted = fitExercise(ex!, narrow)
      const roots = buildRoots(fitted, narrow, 0, 'auto')
      expect(roots.length).toBeGreaterThan(0)
      for (const root of roots) {
        for (const n of fitted.notes) {
          expect(root + n.s).toBeGreaterThanOrEqual(narrow.lo)
          expect(root + n.s).toBeLessThanOrEqual(narrow.hi)
          if (n.glide != null) {
            expect(root + n.glide).toBeGreaterThanOrEqual(narrow.lo)
            expect(root + n.glide).toBeLessThanOrEqual(narrow.hi)
          }
        }
      }
    }
    const sirenFitted = fitExercise((exerciseById('siren-full') ?? libExercise('siren-full'))!, narrow)
    expect(sirenFitted.notes[1].glide!).toBeGreaterThan(sirenFitted.notes[1].s)
    expect(sirenFitted.notes[2].glide!).toBeLessThan(sirenFitted.notes[2].s)
  })

  it('caps zero/narrow-span ladder reps to <= 10 on wide ranges', () => {
    const wide = { lo: 45, hi: 70 }
    for (const id of ['messa', 'twang', 'five-vowels']) {
      const ex = exerciseById(id)!
      expect(ex).toBeDefined()
      const roots = buildRoots(ex, wide, 0, 'auto')
      expect(roots.length).toBeLessThanOrEqual(10)
      expect(roots.length).toBeGreaterThanOrEqual(3)
    }
  })
})
