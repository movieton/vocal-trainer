import { tr } from './i18n'
import { syllabify, type KeyChord } from './theory'
import type { MelNote } from '../components/MelodyEditor'
import type { Range } from './store'
import type { Song, SongNote } from '../data/songs'
import { clampTitle, MAX_SUB_LEN, MAX_SYL_LEN } from './customSongs'

export type ComposePartInput = {
  name?: string
  prog?: KeyChord[]
  melody: MelNote[]
  lyrics?: string
}

export type ComposeToSongInput = {
  id?: string
  title?: string
  sub?: string
  bpm: number
  tonic: number
  parts: ComposePartInput[]
  workRange?: Range
}

const roundBeat = (v: number) => Math.round(v * 1000) / 1000

/**
 * Конвертирует части из «Сочинения» в структуру `Song` для пения в разделе «Песни».
 * При отсутствии нот во всех частях возвращает `null`.
 */
export function composeToSong(input: ComposeToSongInput): Song | null {
  const nonEmptyParts = input.parts
    .map((p, idx) => ({
      name: p.name?.trim() || tr('Часть {0}', idx + 1),
      lyrics: p.lyrics ?? '',
      notes: (p.melody ?? [])
        .filter(n => Number.isFinite(n.m) && Number.isFinite(n.beat) && Number.isFinite(n.d) && n.d > 0 && n.beat >= 0)
        .sort((a, b) => a.beat - b.beat),
    }))
    .filter(p => p.notes.length > 0)

  if (!nonEmptyParts.length) return null

  const allMidi = nonEmptyParts.flatMap(p => p.notes.map(n => Math.round(n.m)))
  const minMidi = Math.min(...allMidi)
  const maxMidi = Math.max(...allMidi)
  const melSpan = maxMidi - minMidi

  // Сохраняем исходную тонику, если вся мелодия помещается в рабочий диапазон; иначе переносим на целое число октав
  let octShift = 0
  if (input.workRange && (minMidi < input.workRange.lo || maxMidi > input.workRange.hi)) {
    const workMid = (input.workRange.lo + input.workRange.hi) / 2
    const melMid = (minMidi + maxMidi) / 2
    octShift = 12 * Math.round((workMid - melMid) / 12)
  }
  const base = Math.round(input.tonic + octShift)

  const phrases: Song['phrases'] = nonEmptyParts.map(part => {
    const syls = syllabify(part.lyrics)
    const notes: SongNote[] = []
    let curBeat = 0

    part.notes.forEach((n, idx) => {
      const startBeat = roundBeat(n.beat)
      const gap = roundBeat(startBeat - curBeat)
      if (gap > 0.01) notes.push({ s: null, d: gap })

      const sy = syls[idx]
      const syl = sy ? (sy.stress ? sy.s.toUpperCase() : sy.s).slice(0, MAX_SYL_LEN) : undefined
      const dur = Math.max(0.125, roundBeat(n.d))
      const rel = Math.round(n.m + octShift) - base
      notes.push(syl ? { s: rel, d: dur, syl } : { s: rel, d: dur })
      curBeat = Math.max(curBeat, roundBeat(startBeat + dur))
    })

    return { label: clampTitle(part.name), notes }
  })

  const level: 1 | 2 | 3 = melSpan <= 7 ? 1 : melSpan <= 12 ? 2 : 3
  const bpm = Math.round(Math.max(40, Math.min(240, Number.isFinite(input.bpm) ? input.bpm : 84)))
  const id = input.id?.trim() || `cmp-${Date.now().toString(36)}`
  const title = clampTitle(input.title ?? '', tr('Из Сочинения'))
  const sub = (input.sub ?? tr('Из Сочинения · {0} уд/мин', bpm)).replace(/\s+/g, ' ').trim().slice(0, MAX_SUB_LEN)

  return {
    id,
    title,
    sub,
    level,
    bpm,
    meter: 4,
    phrases,
    base,
  }
}
