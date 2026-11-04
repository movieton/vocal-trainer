import { engine } from './audio'
import { median } from './music'
import { targetAt, type NoteResult, type Target } from './run'

/** Фраза упражнения в секундах от её начала */
export type Phrase = {
  label?: string
  piano: { m: number; t: number; d: number; vel?: number }[]
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
  targets: Target[] = []
  results: PhraseResult[] = []
  label = ''
  done = false
  phase: 'listen' | 'sing' = 'listen'
  repeat = false
  /** Сдвиг всего упражнения в полутонах (ручная подстройка высоты) */
  shift = 0
  private cur: Phrase | null = null
  private t0 = 0
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
    this.done = true
    engine.stopAll()
    engine.simTarget = null
  }

  private next(t: number) {
    const p = this.repeat && this.cur ? this.cur : this.gen(this.i)
    if (!p) { this.stop(); return }
    this.cur = p
    this.t0 = t
    this.label = p.label ?? ''
    const k = this.shift
    for (const e of p.piano) engine.play(e.m + k, t + e.t, e.d, e.vel ?? 60)
    for (const n of p.notes) this.targets.push({ midi: n.m + k, midiEnd: n.mEnd != null ? n.mEnd + k : undefined, t0: t + n.t, t1: t + n.t + n.d, syl: n.syl, sing: n.sing, hidden: n.hidden, rep: this.i })
    const sung = p.notes.filter(n => n.sing)
    this.singStart = t + (sung.length ? Math.min(...sung.map(n => n.t)) : p.len)
    this.targets = this.targets.filter(g => g.rep >= this.i - 1)
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
    this.phase = now >= this.singStart ? 'sing' : 'listen'
    if (now > this.t0 + this.cur.len + 0.25) {
      this.score()
      if (!this.repeat) this.i++
      this.next(now + 0.3)
      return true
    }
    return prev !== this.phase
  }

  private score() {
    const sung = this.targets.filter(g => g.rep === this.i && g.sing)
    const notes = sung.map(g => {
      const from = g.t0 + 0.2 * (g.t1 - g.t0)
      const frames = engine.history.filter(s => s.t >= from && s.t < g.t1)
      const cents = frames.filter(s => s.midi != null).map(s => (s.midi! - targetAt(g, s.t)) * 100)
      g.score = frames.length ? cents.filter(c => Math.abs(c) <= this.tolerance).length / frames.length : 0
      return { m: g.midi, score: g.score, cents: cents.length ? median(cents) : null }
    })
    const score = notes.length ? notes.reduce((a, n) => a + n.score, 0) / notes.length : 0
    this.results.push({ label: this.label, score, notes })
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
