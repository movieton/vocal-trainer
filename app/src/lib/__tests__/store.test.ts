import { beforeEach, describe, expect, it } from 'vitest'
import { DEVICE_KEYS, read, workRange, write } from '../store'

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
