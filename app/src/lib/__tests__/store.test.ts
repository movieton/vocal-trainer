import { beforeEach, describe, expect, it } from 'vitest'
import { earned } from '../achievements'
import { clearSynced, countsAsPractice, DEVICE_KEYS, logSession, MIN_VOICED_FRAMES, read, streak, workRange, write, type SessionLog } from '../store'

describe('store workRange & storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('computes 70% upper-sparing range from measured range when voice === measured', () => {
    expect(workRange({ lo: 45, hi: 75 }, 'measured')).toEqual({
      lo: 46,
      hi: 66,
      source: 'по твоему замеру',
    })
  })

  it('enforces minimum 10-semitone span when measured range is very narrow', () => {
    expect(workRange({ lo: 60, hi: 66 }, 'measured')).toEqual({
      lo: 61,
      hi: 71,
      source: 'по твоему замеру',
    })
  })

  it('uses named voice preset and falls back to Баритон for unknown voice', () => {
    expect(workRange(null, 'Сопрано')).toEqual({
      lo: 62,
      hi: 80,
      source: 'сопрано',
    })
    expect(workRange(null, 'Неизвестный')).toEqual({
      lo: 47,
      hi: 65,
      source: 'баритон',
    })
  })

  it('keeps DEVICE_KEYS separated and reads/writes prefixed storage', () => {
    expect(DEVICE_KEYS.has('latencyMs')).toBe(true)
    expect(DEVICE_KEYS.has('micOk')).toBe(true)
    expect(DEVICE_KEYS.has('log')).toBe(false)

    write('goal', 'ear')
    expect(read('goal', 'pitch')).toBe('ear')
    expect(localStorage.getItem('vt:goal')).toBe('"ear"')
  })
})

const silent: SessionLog = { date: Date.now(), kind: 'exercise', id: 'lip-trill-5', title: 'Губная трель', score: 0, reps: 1, hits: 0 }
const sung: SessionLog = { ...silent, score: 0, hits: 0 }

describe('silent sessions stay out of history, streak and achievements', () => {
  beforeEach(() => { clearSynced(new Set()) })

  it('treats fewer than MIN_VOICED_FRAMES as no practice', () => {
    expect(MIN_VOICED_FRAMES).toBe(4)
    expect(countsAsPractice(0)).toBe(false)
    expect(countsAsPractice(3)).toBe(false)
    expect(countsAsPractice(4)).toBe(true)
  })

  it('does not log a silent or blip pitch session, so streak and the first bean stay empty', () => {
    expect(logSession(silent, { voicedFrames: 0 })).toBe(false)
    expect(logSession({ ...silent, kind: 'ear', id: 'pitch-match' }, { voicedFrames: 2 })).toBe(false)
    expect(read<SessionLog[]>('log', [])).toEqual([])
    expect(streak(read<SessionLog[]>('log', []))).toBe(0)
    expect(earned({ log: read('log', []), notationDone: [], kgBest: {}, rangeHist: [], threshold: [] })).not.toContain('first')
  })

  it('logs an out-of-tune session that actually had pitch, and still logs quizzes without a gate', () => {
    expect(logSession(sung, { voicedFrames: 12 })).toBe(true)
    expect(logSession({ date: Date.now() + 1, kind: 'ear', id: 'quiz', title: 'Интервалы', score: 80, reps: 10 })).toBe(true)
    const log = read<SessionLog[]>('log', [])
    expect(log).toHaveLength(2)
    expect(streak(log)).toBe(1)
    expect(earned({ log, notationDone: [], kgBest: {}, rangeHist: [], threshold: [] })).toContain('first')
  })
})
