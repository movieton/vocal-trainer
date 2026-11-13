import { engine } from './audio'
import { median } from './music'
import { targetAt, type NoteResult, type Target } from './run'

/** Фраза упражнения в секундах от её начала */
export type Phrase = {
  label?: string
  /** voice: эталонная мелодическая нота — звучит выбранным тембром эталона */
  piano: { m: number; t: number; d: number; vel?: number; voice?: boolean }[]
  /** sing: false — нота-ориентир (контур), hidden — твоя нота скрыта до момента, пока не пройдёт */
  notes: { m: number; mEnd?: number; t: number; d: number; syl?: string; sing: boolean; hidden?: boolean }[]
  len: number
  /** Подписи по времени, например названия аккордов */
  marks?: { t: number; text: string }[]
}

export type PhraseResult = { label?: string; score: number; notes: NoteResult[] }

/** Проигрывает поток фраз из генератора и оценивает пение. Общий движок для упражнений на слух. */
export class PhraseRun {
  gen: (i: number) => Phrase | null
  tolerance: number
  i = 0
  /** Сквозной номер прохода: растёт всегда, в т.ч. в режиме повтора — по нему оцениваем и чистим цели */
  seq = 0
  targets: Target[] = []
  all: Target[] = []
  results: PhraseResult[] = []
  label = ''
  done = false
  phase: 'listen' | 'count' | 'sing' = 'listen'
  /** Сколько долей отсчёта осталось до вступления (для подписи «3, 2, 1») */
  count = 0
  private counts: number[] = []
  repeat = false
  /** Подсказка: 0 — пианино ведёт мелодию, 1 — только метроном, 2 — тишина */
  hint: 0 | 1 | 2 = 0
  /** Промахов (нота спета мимо) — в режимах без подсказки после трёх заход заканчивается */
  misses = 0
  static MAX_MISSES = 3
  /** Сдвиг всего упражнения в полутонах (ручная подстройка высоты) */
  shift = 0
  private cur: Phrase | null = null
  private t0 = 0
  private len = 0
  private singStart = 0

  constructor(gen: (i: number) => Phrase | null, tolerance: number) {
    this.gen = gen
    this.tolerance = tolerance
  }

  start() {
    const ctx = engine.ensureCtx()
    engine.simTarget = t => this.simPitch(t)
    this.next(ctx.currentTime + 0.4)
  }

  stop() {
    engine.listenOnly = false
    this.done = true
    engine.stopAll()
    engine.simTarget = null
  }

  private next(t: number) {
    const raw = this.repeat && this.cur ? this.cur : this.gen(this.i)
    if (!raw) { this.stop(); return }
    const p = fadeHints(withCountIn(raw), this.hint)
    this.counts = (p.counts ?? []).map(c => t + c)
    for (const [k, c] of this.counts.entries()) engine.click(k === 0, c)
    for (const c of p.metro ?? []) engine.click(false, t + c)
    this.cur = raw
    this.t0 = t
    this.len = p.len
    this.label = p.label ?? ''
    const k = this.shift
    for (const e of p.piano) (e.voice ? engine.ref : engine.play).call(engine, e.m + k, t + e.t, e.d, e.vel ?? 60)
    for (const n of p.notes) {
      const tg = { midi: n.m + k, midiEnd: n.mEnd != null ? n.mEnd + k : undefined, t0: t + n.t, t1: t + n.t + n.d, syl: n.syl, sing: n.sing, hidden: n.hidden, rep: this.seq }
      this.targets.push(tg); this.all.push(tg)
    }
    const sung = p.notes.filter(n => n.sing)
    this.singStart = t + (sung.length ? Math.min(...sung.map(n => n.t)) : p.len)
    this.targets = this.targets.filter(g => g.rep >= this.seq - 1)
  }

  /** Текущая подпись (аккорд) в момент now */
  mark(now: number) {
    const ms = this.cur?.marks
    if (!ms) return ''
    let txt = ''
    for (const m of ms) if (now >= this.t0 + m.t) txt = m.text
    return txt
  }

  /** true — изменилось что-то для интерфейса */
  update(now: number): boolean {
    if (this.done || !this.cur) return false
    const prev = this.phase
    const left = this.counts.length - this.counts.filter(c => c <= now + 0.05).length + 1
    this.phase = now >= this.singStart ? 'sing' : this.counts.length && now >= this.counts[0] - 0.05 ? 'count' : 'listen'
    const prevCount = this.count
    this.count = this.phase === 'count' ? Math.max(1, left) : 0
    engine.listenOnly = this.phase !== 'sing'
    // запас на хвост последней ноты: кадры с поправкой на наушники приходят позже
    if (now > this.t0 + this.len + 0.25 + engine.latency) {
      this.score()
      if (this.done) return true
      this.seq++
      if (!this.repeat) this.i++
      // пауза на вдох перед следующей фразой
      this.next(now + 0.9)
      return true
    }
    return prev !== this.phase || prevCount !== this.count
  }

  private score() {
    const sung = this.targets.filter(g => g.rep === this.seq && g.sing)
    const notes = sung.map(g => {
      const from = g.t0 + 0.2 * (g.t1 - g.t0)
      const frames = engine.history.filter(s => s.t >= from && s.t < g.t1)
      const cents = frames.filter(s => s.midi != null).map(s => (s.midi! - targetAt(g, s.t)) * 100)
      g.score = frames.length ? cents.filter(c => Math.abs(c) <= this.tolerance).length / frames.length : 0
      return { m: g.midi, score: g.score, cents: cents.length ? median(cents) : null }
    })
    const score = notes.length ? notes.reduce((a, n) => a + n.score, 0) / notes.length : 0
    this.results.push({ label: this.label, score, notes })
    if (this.hint) { this.misses += notes.filter(n => n.score < 0.5).length; if (this.misses >= PhraseRun.MAX_MISSES) this.stop() }
  }

  private simPitch(t: number) {
    const g = this.targets.find(x => x.sing && t >= x.t0 && t < x.t1)
    if (!g) return null
    return targetAt(g, t) + [0.05, -0.3, 0.1, 0.02, -0.5][this.targets.indexOf(g) % 5]
  }

  summary() {
    const all = this.results.flatMap(r => r.notes)
    const score = all.length ? all.reduce((a, n) => a + n.score, 0) / all.length : 0
    return { score, reps: this.results.length }
  }
}

/**
 * Если фраза начинается с показа (пианино играет, человек слушает), между показом и пением
 * вставляем отсчёт на две доли со щелчками — чтобы успеть перестроиться и вдохнуть.
 */
export function withCountIn(p: Phrase): Phrase & { counts?: number[]; beat?: number } {
  const sung = p.notes.filter(n => n.sing)
  if (!sung.length) return p
  const singT = Math.min(...sung.map(n => n.t))
  if (singT < 0.2 || !p.piano.some(e => e.t < singT - 0.05)) return p
  const ds = sung.map(n => n.d).sort((a, b) => a - b)
  const beat = Math.min(0.8, Math.max(0.5, ds[Math.floor(ds.length / 2)]))
  const gap = beat * 3
  const from = singT - 0.01
  const sh = <T extends { t: number }>(e: T) => (e.t >= from ? { ...e, t: e.t + gap } : e)
  return {
    ...p, len: p.len + gap,
    piano: p.piano.map(sh), notes: p.notes.map(sh), marks: p.marks?.map(sh),
    counts: [0, 1, 2].map(k => singT + k * beat), beat,
  }
}

/**
 * Снятие подсказок. Убираем только то, что подсказывает саму мелодию: одиночные ноты пианино
 * на тех же высотах, что и твои ноты. Аккорды и каденция (они задают тональность) остаются.
 * 1 — мелодию слышишь один раз в показе, при пении — только щелчки метронома.
 * 2 — показа мелодии нет (звучит лишь первая нота), щелчков во время пения нет, твои ноты проявляются после пения.
 */
export function fadeHints<P extends Phrase & { counts?: number[]; beat?: number }>(p: P, hint: number): P & { metro?: number[] } {
  if (!hint) return p
  const sung = p.notes.filter(n => n.sing)
  if (!sung.length) return p
  const singT = Math.min(...sung.map(n => n.t))
  const pitches = new Set(sung.map(n => n.m))
  const solo = (e: Phrase['piano'][number]) => e.voice || p.piano.filter(x => Math.abs(x.t - e.t) < 0.03).length === 1
  const melodic = (e: Phrase['piano'][number]) => pitches.has(e.m) && solo(e)
  // первая нота мелодии остаётся всегда — от неё строится всё остальное
  // (если поёшь одну ноту, её подсказка и есть ответ — в тишине убираем и её)
  const firstShow = hint === 2 && sung.length === 1 ? undefined : p.piano.filter(melodic).sort((a, b) => a.t - b.t)[0]
  const piano = p.piano.filter(e => {
    if (!melodic(e) || e === firstShow) return true
    return hint === 1 && e.t < singT - 0.01
  })
  const metro: number[] = []
  if (hint === 1) {
    const ds = sung.map(n => n.d).sort((a, b) => a - b)
    const beat = p.beat ?? Math.min(0.8, Math.max(0.5, ds[Math.floor(ds.length / 2)]))
    for (let t = singT; t < p.len - 0.05; t += beat) metro.push(t)
  }
  return { ...p, piano, metro,
    notes: hint === 2 ? p.notes.map(n => (n.sing ? { ...n, hidden: true } : n)) : p.notes }
}
