import { describe, expect, it } from 'vitest'
import { analyzeTone, ftom, isBlack, latinName, mtof, noteName, plural, transcribe } from '../music'

describe('music pitch & note helpers', () => {
  it('converts MIDI <-> Hz cleanly around A4=440', () => {
    expect(mtof(69)).toBeCloseTo(440, 8)
    expect(mtof(57)).toBeCloseTo(220, 8)
    expect(mtof(81)).toBeCloseTo(880, 8)
    expect(ftom(440)).toBeCloseTo(69, 8)
    expect(ftom(mtof(60))).toBeCloseTo(60, 8)
    expect(ftom(mtof(72))).toBeCloseTo(72, 8)
  })

  it('formats note names and detects black keys', () => {
    expect(latinName(60)).toBe('C4')
    expect(latinName(69)).toBe('A4')
    expect(latinName(61)).toBe('C#4')
    expect(noteName(60)).toBe('До4')
    expect(noteName(69)).toBe('Ля4')
    expect(isBlack(60)).toBe(false)
    expect(isBlack(61)).toBe(true)
    expect(isBlack(64)).toBe(false)
    expect(isBlack(66)).toBe(true)
  })

  it('formats Russian plurals', () => {
    const forms: [string, string, string] = ['день', 'дня', 'дней']
    expect(plural(1, forms)).toBe('день')
    expect(plural(2, forms)).toBe('дня')
    expect(plural(5, forms)).toBe('дней')
    expect(plural(11, forms)).toBe('дней')
    expect(plural(21, forms)).toBe('день')
  })
})

describe('analyzeTone', () => {
  it('returns null when fewer than 20 voiced samples are provided', () => {
    const samples = Array.from({ length: 19 }, (_, i) => ({ t: i * 0.02, midi: 60 }))
    expect(analyzeTone(samples, 60)).toBeNull()
  })

  it('measures a steady pitch in tune with minimal drift and no vibrato', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({ t: i * 0.02, midi: 60 }))
    const res = analyzeTone(samples, 60, 15)
    expect(res).not.toBeNull()
    expect(res!.center).toBeCloseTo(60, 5)
    expect(res!.sd).toBeCloseTo(0, 5)
    expect(res!.inTune).toBeCloseTo(1, 5)
    expect(res!.vibrato).toBe(false)
  })

  it('detects vibrato around 5.5 Hz and ±40 cents', () => {
    const samples = Array.from({ length: 150 }, (_, i) => {
      const t = i * 0.02 // 3 seconds at 50 Hz
      const cents = 40 * Math.sin(2 * Math.PI * 5.5 * t)
      return { t, midi: 64 + cents / 100 }
    })
    const res = analyzeTone(samples, 64, 15)
    expect(res).not.toBeNull()
    expect(res!.vibrato).toBe(true)
    expect(res!.rate).toBeGreaterThan(4.5)
    expect(res!.rate).toBeLessThan(6.5)
    expect(res!.extent).toBeGreaterThan(20)
    expect(res!.regularity).toBeGreaterThan(0.5)
  })
})

describe('transcribe', () => {
  it('segments distinct sustained notes on a beat grid', () => {
    const frames: { t: number; midi: number | null }[] = []
    // Beat = 0.5s; 2 beats C4 (0..1.0s), 2 beats E4 (1.0..2.0s)
    for (let t = 0; t < 2.0; t += 0.02) {
      frames.push({ t, midi: t < 1.0 ? 60.05 : 63.95 })
    }
    const notes = transcribe(frames, 0, 0.5, 4)
    expect(notes.length).toBe(2)
    expect(notes[0]).toEqual({ m: 60, beat: 0, d: 2 })
    expect(notes[1]).toEqual({ m: 64, beat: 2, d: 2 })
  })
})
