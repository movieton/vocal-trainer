import { tr } from './i18n'
import { useCallback } from 'react'
import { read, useStored, write } from './store'
import type { Song, SongNote } from '../data/songs'

export const MAX_CUSTOM_SONGS = 25
export const MAX_TITLE_LEN = 80
export const MAX_SUB_LEN = 120
export const MAX_SYL_LEN = 24
const MAX_PHRASES = 32
const MAX_NOTES_PER_PHRASE = 256

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export function clampTitle(title: string, fallback = tr('Моя песня')): string {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LEN).trim()
  return clean || fallback
}

function sanitizeNote(raw: unknown): SongNote | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const d = typeof r.d === 'number' && Number.isFinite(r.d) && r.d > 0 ? Math.min(32, Math.round(r.d * 1000) / 1000) : null
  if (d == null) return null
  const s = r.s == null ? null : typeof r.s === 'number' && Number.isFinite(r.s) ? Math.round(clamp(r.s, -48, 48)) : undefined
  if (s === undefined) return null
  const syl = typeof r.syl === 'string' ? r.syl.trim().slice(0, MAX_SYL_LEN) : ''
  return syl ? { s, d, syl } : { s, d }
}

export function sanitizeSong(raw: unknown): Song | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim().slice(0, 64) : ''
  if (!id || !Array.isArray(r.phrases)) return null
  const phrases: Song['phrases'] = []
  let pitchedNotes = 0
  for (let i = 0; i < r.phrases.length && phrases.length < MAX_PHRASES; i++) {
    const p = r.phrases[i]
    if (!p || typeof p !== 'object') continue
    const pr = p as Record<string, unknown>
    if (!Array.isArray(pr.notes)) continue
    const notes: SongNote[] = []
    for (let j = 0; j < pr.notes.length && notes.length < MAX_NOTES_PER_PHRASE; j++) {
      const n = sanitizeNote(pr.notes[j])
      if (n) {
        notes.push(n)
        if (n.s != null) pitchedNotes++
      }
    }
    if (!notes.length) continue
    const label = typeof pr.label === 'string' && pr.label.trim() ? pr.label.trim().slice(0, MAX_TITLE_LEN) : tr('Фраза {0}', phrases.length + 1)
    phrases.push({ label, notes })
  }
  if (!phrases.length || pitchedNotes === 0) return null
  const level = r.level === 2 || r.level === 3 ? r.level : 1
  const bpm = typeof r.bpm === 'number' && Number.isFinite(r.bpm) ? Math.round(clamp(r.bpm, 40, 240)) : 90
  const meter = typeof r.meter === 'number' && Number.isFinite(r.meter) ? Math.round(clamp(r.meter, 2, 7)) : 4
  const base = typeof r.base === 'number' && Number.isFinite(r.base) ? Math.round(clamp(r.base, 24, 108)) : undefined
  const title = clampTitle(typeof r.title === 'string' ? r.title : '')
  const sub = typeof r.sub === 'string' ? r.sub.replace(/\s+/g, ' ').trim().slice(0, MAX_SUB_LEN) : ''
  return {
    id,
    title,
    sub,
    level,
    bpm,
    meter,
    phrases,
    ...(base != null ? { base } : {}),
  }
}

export function normalizeCustomSongs(raw: unknown): Song[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Song[] = []
  for (const item of raw) {
    const s = sanitizeSong(item)
    if (!s || seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s)
    if (out.length >= MAX_CUSTOM_SONGS) break
  }
  return out
}

/** Идемпотентная миграция одиночной `songs.mine` в массив `songs.custom` без дублирования */
export function migrateCustomSongs(customRaw: unknown, mineRaw: unknown): Song[] {
  const existing = normalizeCustomSongs(customRaw)
  const mine = sanitizeSong(mineRaw)
  if (!mine) return existing
  const migrated: Song = { ...mine, id: mine.id || 'mine' }
  if (existing.some(s => s.id === migrated.id)) return existing
  if (existing.length >= MAX_CUSTOM_SONGS) return existing
  return [migrated, ...existing]
}

/** Выполняет автоматическую однократную миграцию `vt:songs.mine` → `songs.custom` */
export function ensureCustomSongs(): Song[] {
  const rawCustom = read<unknown>('songs.custom', null)
  if (rawCustom == null) {
    const rawMine = read<unknown>('songs.mine', null)
    const mine = sanitizeSong(rawMine)
    if (mine) {
      const migrated = migrateCustomSongs(null, mine)
      write('songs.custom', migrated, true)
      return migrated
    }
    return []
  }
  return normalizeCustomSongs(rawCustom)
}

export function readCustomSongs(): Song[] {
  return ensureCustomSongs()
}

export type AddCustomResult =
  | { ok: true; song: Song; list: Song[] }
  | { ok: false; reason: 'limit' | 'invalid' }

export function addCustomSong(rawSong: Song): AddCustomResult {
  const clean = sanitizeSong(rawSong)
  if (!clean) return { ok: false, reason: 'invalid' }
  const current = ensureCustomSongs()
  const idx = current.findIndex(s => s.id === clean.id)
  if (idx < 0 && current.length >= MAX_CUSTOM_SONGS) return { ok: false, reason: 'limit' }
  const next = idx >= 0
    ? current.map((s, i) => (i === idx ? clean : s))
    : [clean, ...current].slice(0, MAX_CUSTOM_SONGS)
  write('songs.custom', next)
  return { ok: true, song: clean, list: next }
}

export function renameCustomSong(id: string, title: string): Song[] {
  const current = ensureCustomSongs()
  const cleanTitle = clampTitle(title, '')
  if (!cleanTitle) return current
  const next = current.map(s => (s.id === id ? { ...s, title: cleanTitle } : s))
  write('songs.custom', next)
  return next
}

export function removeCustomSong(id: string): Song[] {
  const current = ensureCustomSongs()
  const next = current.filter(s => s.id !== id)
  write('songs.custom', next)
  const mine = read<unknown>('songs.mine', null) as { id?: string } | null
  if (mine && (mine.id === id || id === 'mine')) write('songs.mine', null, true)
  return next
}

export function useCustomSongs() {
  const [raw] = useStored<unknown>('songs.custom', null)
  const [rawMine] = useStored<unknown>('songs.mine', null)
  const songs = raw == null ? migrateCustomSongs(null, rawMine) : normalizeCustomSongs(raw)
  const add = useCallback((song: Song) => addCustomSong(song), [])
  const rename = useCallback((id: string, title: string) => renameCustomSong(id, title), [])
  const remove = useCallback((id: string) => removeCustomSong(id), [])
  return { songs, add, rename, remove, atLimit: songs.length >= MAX_CUSTOM_SONGS }
}
