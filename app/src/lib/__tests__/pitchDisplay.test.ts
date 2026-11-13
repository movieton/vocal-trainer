import { describe, expect, it } from 'vitest'
import { noteName } from '../music'
import { activeTargetMidi, computePitchDisplay, trainerViewWindow } from '../pitchDisplay'
import type { Target } from '../run'

describe('computePitchDisplay & activeTargetMidi', () => {
  it('shows nearest chromatic note and cents when no target is active or paused', () => {
    const res = computePitchDisplay(60.22, null)
    expect(res).toEqual({ note: noteName(60), cents: 22, isTarget: false })

    const targets: Target[] = [{ midi: 64, t0: 10, t1: 12, sing: true, rep: 0 }]
    expect(activeTargetMidi(targets, 11, true)).toBeNull()
    expect(activeTargetMidi(targets, 5, false)).toBeNull()
  })

  it('shows target note name and cents offset relative to targetMidi', () => {
    const res = computePitchDisplay(63.75, 64)
    expect(res).toEqual({ note: noteName(64), cents: -25, isTarget: true })

    // Supports interpolated glissando target
    const glissTargets: Target[] = [{ midi: 60, midiEnd: 64, t0: 10, t1: 14, sing: true, rep: 0 }]
    const mid = activeTargetMidi(glissTargets, 12, false)
    expect(mid).toBe(62)
    expect(computePitchDisplay(62.15, mid)).toEqual({ note: noteName(62), cents: 15, isTarget: true })
  })
})

describe('trainerViewWindow', () => {
  it('keeps full range when idle or ladder is compact', () => {
    const roots = [48, 49, 50, 51, 52, 51, 50, 49, 48] // range 4 semitones
    expect(trainerViewWindow(roots, [0, 4, 7], 2, true)).toEqual({ lo: 46, hi: 61 })
  })

  it('focuses vertical window around activeRep on wide 17-rep ladders while running', () => {
    const up = Array.from({ length: 10 }, (_, i) => 48 + i)
    const ladder = up.concat(up.slice(0, -1).reverse()) // 19 reps, roots 48..57 + notes 0..12 => allHi - allLo = 25
    const idleWin = trainerViewWindow(ladder, [0, 4, 7, 12], 0, false)
    expect(idleWin.hi - idleWin.lo).toBeGreaterThan(20)

    const runWinStart = trainerViewWindow(ladder, [0, 4, 7, 12], 0, true)
    expect(runWinStart.hi - runWinStart.lo).toBeLessThan(idleWin.hi - idleWin.lo)
    expect(runWinStart.lo).toBe(46)

    const runWinPeak = trainerViewWindow(ladder, [0, 4, 7, 12], 9, true)
    expect(runWinPeak.lo).toBeGreaterThan(runWinStart.lo)
    expect(runWinPeak.hi).toBeLessThanOrEqual(idleWin.hi)
  })
})
