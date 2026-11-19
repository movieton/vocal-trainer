import { describe, expect, it } from 'vitest'
import { classifyMicError, hasSimParam, micBlockText, OctaveFilter, pickFftSize } from '../audio'

describe('audio DSP helpers', () => {
  it('picks adaptive fftSize based on sampleRate', () => {
    expect(pickFftSize(44100)).toBe(2048)
    expect(pickFftSize(48000)).toBe(2048)
    expect(pickFftSize(96000)).toBe(4096)
  })

  it('detects ?sim in both query search and hash', () => {
    expect(hasSimParam('?sim=1', '')).toBe(true)
    expect(hasSimParam('', '#/tuner?sim=1')).toBe(true)
    expect(hasSimParam('', '#/ex/siren-full?foo=1&sim=1')).toBe(true)
    expect(hasSimParam('', '#/tuner')).toBe(false)
  })

  it('suppresses 1-3 frame octave glitches but allows sustained 4+ frame octave jumps', () => {
    const filter = new OctaveFilter()
    // 2-frame +12 spike
    expect([60, 60, 72, 72, 60].map(m => filter.push(m))).toEqual([60, 60, 60, 60, 60])
    // 3-frame -12 spike
    expect([48, 48, 48, 60].map(m => filter.push(m))).toEqual([60, 60, 60, 60])
    // sustained 4-frame +12 jump (octave-jump / octave-lift)
    expect([72, 72, 72, 72, 72].map(m => filter.push(m))).toEqual([60, 60, 60, 72, 72])
  })

  it('classifies a missed or denied mic prompt separately from a missing device', () => {
    for (const name of ['NotAllowedError', 'PermissionDeniedError', 'SecurityError', 'AbortError']) {
      const fail = classifyMicError({ name, message: 'denied' })
      expect(fail.kind).toBe('denied')
      expect(fail.message).toMatch(/замка/)
      expect(fail.message).toMatch(/Повторить/)
    }
    expect(classifyMicError(new Error('NO_MEDIA_DEVICES')).kind).toBe('missing')
    const missing = classifyMicError({ name: 'NotFoundError', message: 'Requested device not found' })
    expect(missing.kind).toBe('missing')
    expect(missing.message).toMatch(/не найден/)
    expect(classifyMicError({ name: 'NotReadableError', message: 'busy' }).kind).toBe('missing')
    expect(classifyMicError({ name: 'Unknown', message: 'boom' }).message).toMatch(/boom/)
  })

  it('explains why Start stays disabled while the mic is pending, denied or off', () => {
    expect(micBlockText('on', '', false, '')).toBeNull()
    expect(micBlockText('starting', '', false, '')).toMatch(/Разрешить/)
    expect(micBlockText('error', 'denied', false, 'long denied copy')).toMatch(/настройках сайта/)
    expect(micBlockText('error', 'missing', false, 'Нет устройства')).toBe('Нет устройства')
    expect(micBlockText('off', '', true, '')).toMatch(/звук и микрофон/)
    expect(micBlockText('off', '', false, '')).toMatch(/включи микрофон/i)
  })

  it('passes glissandos immediately and resets anchor after extended silence', () => {
    const filter = new OctaveFilter()
    const gliss = [60, 62, 64, 66, 68, 70, 72]
    expect(gliss.map(m => filter.push(m))).toEqual(gliss)

    for (let i = 0; i < 21; i++) expect(filter.push(null)).toBeNull()
    expect(filter.push(48)).toBe(48)
  })
})
