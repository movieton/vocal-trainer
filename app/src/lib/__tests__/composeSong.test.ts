import { describe, expect, it, beforeEach } from 'vitest'
import { composeToSong } from '../composeSong'
import { addCustomSong, ensureCustomSongs, MAX_CUSTOM_SONGS, MAX_TITLE_LEN, migrateCustomSongs, readCustomSongs, removeCustomSong, renameCustomSong } from '../customSongs'
import { clearSynced } from '../store'
import type { Song } from '../../data/songs'

describe('composeToSong', () => {
  it('returns null on empty melody', () => {
    expect(composeToSong({
      bpm: 90,
      tonic: 60,
      parts: [{ name: 'Verse', melody: [], lyrics: '' }, { name: 'Chorus', melody: [] }],
    })).toBeNull()
  })

  it('sorts notes by beat, inserts pauses, binds syllabify, truncates long titles and shifts octave to fit workRange', () => {
    const longTitle = 'ОченьДлинноеНазваниеПесниБезПробеловКотороеТочноПревышаетВосемьдесятСимволовИДолжноБытьОбрезано'
    const song = composeToSong({
      id: 'cmp-test-1',
      title: longTitle,
      bpm: 96,
      tonic: 72, // C5 — above baritone workRange below
      workRange: { lo: 47, hi: 65 },
      parts: [
        {
          name: 'Куплет',
          lyrics: 'гори+ свет',
          melody: [
            { m: 76, beat: 3, d: 1 }, // E5 (out of order)
            { m: 72, beat: 0.5, d: 1 }, // C5 (leading 0.5 gap + 1.5 inter-note gap)
          ],
        },
        {
          name: 'Пустая часть',
          melody: [],
        },
      ],
    })

    expect(song).not.toBeNull()
    expect(song!.title.length).toBeLessThanOrEqual(MAX_TITLE_LEN)
    expect(song!.bpm).toBe(96)
    expect(song!.phrases).toHaveLength(1)
    // Shifted down one octave into workRange (base = 72 - 12 = 60)
    expect(song!.base).toBe(60)
    expect(song!.phrases[0].notes).toEqual([
      { s: null, d: 0.5 },
      { s: 0, d: 1, syl: 'го' },
      { s: null, d: 1.5 },
      { s: 4, d: 1, syl: 'РИ' },
    ])
  })
})

describe('customSongs migration and 25-song limit', () => {
  beforeEach(() => {
    localStorage.clear()
    clearSynced(new Set())
  })

  it('migrates songs.mine -> songs.custom idempotently without duplicates', () => {
    const legacy: Song = {
      id: 'mine',
      title: 'Старая запись',
      sub: 'Напета тобой',
      level: 1,
      bpm: 90,
      meter: 4,
      phrases: [{ label: 'Фраза 1', notes: [{ s: 0, d: 1 }, { s: 2, d: 1 }, { s: 4, d: 1 }] }],
      base: 57,
    }
    localStorage.setItem('vt:songs.mine', JSON.stringify(legacy))

    const first = ensureCustomSongs()
    const second = ensureCustomSongs()
    expect(first).toHaveLength(1)
    expect(second).toHaveLength(1)
    expect(readCustomSongs()).toHaveLength(1)
    expect(second[0].id).toBe('mine')

    // Pure migration repeated multiple times never duplicates
    const pureOnce = migrateCustomSongs(first, legacy)
    const pureTwice = migrateCustomSongs(pureOnce, legacy)
    expect(pureTwice).toHaveLength(1)
  })

  it('enforces MAX_CUSTOM_SONGS = 25, supports rename and remove', () => {
    for (let i = 0; i < MAX_CUSTOM_SONGS; i++) {
      const res = addCustomSong({
        id: `s-${i}`,
        title: `Song ${i}`,
        sub: '',
        level: 1,
        bpm: 90,
        meter: 4,
        phrases: [{ label: 'P1', notes: [{ s: 0, d: 1 }] }],
      })
      expect(res.ok).toBe(true)
    }
    expect(readCustomSongs()).toHaveLength(MAX_CUSTOM_SONGS)

    const overflow = addCustomSong({
      id: 's-overflow',
      title: 'Too many',
      sub: '',
      level: 1,
      bpm: 90,
      meter: 4,
      phrases: [{ label: 'P1', notes: [{ s: 0, d: 1 }] }],
    })
    expect(overflow).toEqual({ ok: false, reason: 'limit' })

    renameCustomSong('s-0', 'Новое название песни')
    expect(readCustomSongs().find(s => s.id === 's-0')?.title).toBe('Новое название песни')

    removeCustomSong('s-0')
    expect(readCustomSongs()).toHaveLength(MAX_CUSTOM_SONGS - 1)
  })
})
