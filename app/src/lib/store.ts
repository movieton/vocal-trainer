import { tr } from './i18n'
import { useCallback, useSyncExternalStore } from 'react'
import { VOICE_TYPES } from './music'

const PREFIX = 'vt:'
const listeners = new Set<() => void>()
/** Настройки устройства: без меток времени, не синхронизируются */
export const DEVICE_KEYS = new Set(['rh.latency', 'reminder', 'latencyMs', 'micOk', 'syncDirty'])
const cache = new Map<string, unknown>()

export function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T
  let v = fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw != null) v = JSON.parse(raw) as T
  } catch { /* приватный режим или битые данные */ }
  cache.set(key, v)
  return v
}

const writeHooks = new Set<(key: string) => void>()
/** Подписка на изменения сохранённых данных (для синхронизации с аккаунтом) */
export const onWrite = (f: (key: string) => void) => { writeHooks.add(f); return () => writeHooks.delete(f) }

export function write<T>(key: string, value: T, silent = false) {
  cache.set(key, value)
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* нет хранилища */ }
  // время правки каждого ключа: при слиянии устройств побеждает более свежая
  if (!silent && key !== 'meta' && !DEVICE_KEYS.has(key)) {
    const meta = { ...read<Record<string, number>>('meta', {}), [key]: Date.now() }
    cache.set('meta', meta)
    try { localStorage.setItem(PREFIX + 'meta', JSON.stringify(meta)) } catch { /* нет хранилища */ }
  }
  listeners.forEach(l => l())
  if (!silent) writeHooks.forEach(h => h(key))
}

/** Стереть сохранённые данные приложения, кроме настроек устройства */
export function clearSynced(keep: Set<string>) {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && !keep.has(k.slice(PREFIX.length))) localStorage.removeItem(k)
  } catch { /* нет хранилища */ }
  cache.clear()
  listeners.forEach(l => l())
}

/** Все сохранённые данные приложения одним объектом */
export function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!)
    }
  } catch { /* нет хранилища */ }
  return out
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l) }

export function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key, fallback))
  const set = useCallback((v: T) => write(key, v), [key])
  return [value, set]
}

export type Goal = 'pitch' | 'range' | 'ear' | 'breath' | 'write'
export const VALID_GOALS: readonly Goal[] = ['pitch', 'range', 'ear', 'breath', 'write']
export type SkillLevel = 'none' | 'base'
export type SkillProfile = { ear: SkillLevel; vocal: SkillLevel }
export type PlanMode = 'mix' | 'split'
export type PlanFocus = { day: string; goal: Goal } | null

export const DEFAULT_SKILL_PROFILE: SkillProfile = { ear: 'none', vocal: 'none' }

export function normalizeGoals(raw: unknown, legacy?: unknown): Goal[] {
  const list = Array.isArray(raw)
    ? raw.filter((g): g is Goal => typeof g === 'string' && (VALID_GOALS as readonly string[]).includes(g))
    : []
  const uniq = [...new Set(list)]
  if (uniq.length) return uniq
  if (typeof legacy === 'string' && (VALID_GOALS as readonly string[]).includes(legacy)) return [legacy as Goal]
  return ['pitch']
}

export function normalizeSkillProfile(raw: unknown): SkillProfile {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    return {
      ear: r.ear === 'base' ? 'base' : 'none',
      vocal: r.vocal === 'base' ? 'base' : 'none',
    }
  }
  return { ...DEFAULT_SKILL_PROFILE }
}

export function readGoals(): Goal[] {
  return normalizeGoals(read<unknown>('goals', null), read<unknown>('goal', 'pitch'))
}

export function writeGoals(next: Goal[]): Goal[] {
  const normalized = normalizeGoals(next)
  write('goals', normalized)
  // Синхронизируем одиночный ключ goal для обратной совместимости со старыми клиентами и merge()
  write('goal', normalized[0])
  return normalized
}

export function useGoals(): [Goal[], (next: Goal[]) => void] {
  const [raw] = useStored<unknown>('goals', null)
  const [legacy] = useStored<unknown>('goal', 'pitch')
  const goals = normalizeGoals(raw, legacy)
  const set = useCallback((next: Goal[]) => { writeGoals(next) }, [])
  return [goals, set]
}

/** Инициализирует новые ключи целей/профиля из старого `goal` при первом запуске без перезаписи меток времени */
export function ensureGoalProfile() {
  const rawGoals = read<unknown>('goals', null)
  const legacyGoal = read<unknown>('goal', null)
  if (!Array.isArray(rawGoals) || !rawGoals.length) {
    if (typeof legacyGoal === 'string' || read('onboarded', false)) {
      write('goals', normalizeGoals(null, legacyGoal), true)
    }
  }
  if (read<unknown>('skillProfile', null) == null && read('onboarded', false)) {
    write('skillProfile', { ...DEFAULT_SKILL_PROFILE }, true)
  }
  if (read<unknown>('planMode', null) == null && read('onboarded', false)) {
    write('planMode', 'mix', true)
  }
}

export type Range = { lo: number; hi: number }
export const DEFAULT_RANGE: Range = { lo: 48, hi: 67 }

/** По чему строить упражнения: тип голоса (стандартный удобный диапазон) или собственный замер */
export const DEFAULT_VOICE = 'Баритон'

/**
 * Рабочий диапазон для упражнений — удобная зона, а не крайние ноты.
 * Для типа голоса: типичный диапазон без двух нижних и четырёх верхних полутонов.
 * Для замера: нижние 70% измеренного, чтобы фальцет и «пиковые» ноты не тянули всё вверх.
 */
export function workRange(measured: Range | null, voice: string): Range & { source: string } {
  if (voice === 'measured' && measured) {
    const lo = measured.lo + 1
    return { lo, hi: Math.max(lo + 10, Math.round(measured.lo + 0.7 * (measured.hi - measured.lo))), source: tr('по твоему замеру') }
  }
  const v = VOICE_TYPES.find(x => x.id === voice) ?? VOICE_TYPES.find(x => x.id === DEFAULT_VOICE)!
  return { lo: v.lo + 2, hi: v.hi - 4, source: v.name.toLowerCase() }
}

export function useWorkRange() {
  const [range] = useStored<Range | null>('range', null)
  const [voice] = useStored('voiceType', DEFAULT_VOICE)
  return workRange(range, voice)
}

export type SessionLog = {
  date: number
  kind: 'exercise' | 'ear' | 'breath'
  id: string
  title: string
  score: number
  reps?: number
  /** Сколько нот спето чисто — для цели дня */
  hits?: number
  drift?: { m: number; c: number }[]
}

export function logSession(entry: SessionLog) {
  const all = read<SessionLog[]>('log', [])
  write('log', [entry, ...all].slice(0, 1000))
}

const dayKey = (t: number) => new Date(t).toDateString()

/** Сколько дней подряд (включая сегодня или вчера) были занятия */
export function streak(log: SessionLog[]) {
  const days = new Set(log.map(l => dayKey(l.date)))
  let n = 0
  const d = new Date()
  if (!days.has(dayKey(+d))) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(+d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

/** Средняя точность по дням за последние n дней (только упражнения с оценкой попадания) */
export function dailyScores(log: SessionLog[], n = 30) {
  const out: { day: Date; avg: number | null; count: number }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i)
    const items = log.filter(l => l.kind !== 'breath' && dayKey(l.date) === d.toDateString())
    out.push({ day: d, avg: items.length ? items.reduce((a, l) => a + l.score, 0) / items.length : null, count: items.length })
  }
  return out
}

/** Ноты, на которых чаще всего уходишь от высоты */
export function problemNotes(log: SessionLog[]) {
  const by = new Map<number, number[]>()
  for (const l of log.slice(0, 200)) for (const d of l.drift ?? []) by.set(d.m, [...(by.get(d.m) ?? []), d.c])
  return [...by].map(([m, c]) => ({ m, c: c.reduce((a, x) => a + x, 0) / c.length, n: c.length }))
    .filter(x => x.n >= 2 || Math.abs(x.c) > 30).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 6)
}
