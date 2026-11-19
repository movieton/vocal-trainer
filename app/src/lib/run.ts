import { engine } from './audio'
import { median } from './music'
import { span, type Exercise } from '../data/exercises'
import type { Range } from './store'

export type Target = {
  midi: number
  midiEnd?: number
  t0: number
  t1: number
  syl?: string
  sing: boolean
  rep: number
  score?: number
  /** Скрыта до момента, пока не пройдёт (тренировка без подсказки) */
  hidden?: boolean
}

/** together — сразу вместе с пианино; call — пианино, потом ты один; echo — пианино, потом снова пианино и ты сверху */
export type Mode = 'together' | 'call' | 'echo'
export type Phase = 'idle' | 'cue' | 'listen' | 'inner' | 'breath' | 'sing' | 'done'
export type NoteResult = { m: number; score: number; cents: number | null; /** Кадры, в которых высота распознана */ voiced: number }
export type RepResult = { root: number; score: number; notes: NoteResult[] }

/** key: 'auto' — тональность идёт по диапазону вверх и вниз; число — фиксированная тональность (0 = до) */
export type Key = 'auto' | number
/**
 * inner — пауза «услышь про себя» между показом и пением (внутренний слух, Pfordresher & Halpern 2013);
 * fade — затухающая подсказка: звук эталона во время пения только через круг
 */
export type RunOptions = { range: Range; mode: Mode; tempo: number; tolerance: number; shift: number; key?: Key; inner?: boolean; fade?: boolean; ladder?: boolean }

/** Высота цели в момент t (с учётом глиссандо) */
export const targetAt = (g: Target, t: number) =>
  g.midiEnd == null ? g.midi : g.midi + (g.midiEnd - g.midi) * Math.min(1, Math.max(0, (t - g.t0) / (g.t1 - g.t0)))

/**
 * Подгоняет размах упражнения под рабочий диапазон: если фраза шире доступного окна,
 * пропорционально сжимает относительные ступени до ближайших полутонов, сохраняя направление контура.
 */
export function fitExercise(ex: Exercise, range: Range): Exercise {
  const { min, max } = span(ex)
  const exSpan = max - min
  const room = Math.max(0, range.hi - range.lo)
  const maxSpan = room >= 2 ? room - 2 : room
  if (exSpan <= maxSpan || exSpan === 0) return ex
  const mapNote = (s: number) => min + Math.round(((s - min) / exSpan) * maxSpan)
  return {
    ...ex,
    notes: ex.notes.map(n => (n.rest ? n : {
      ...n,
      s: mapNote(n.s),
      glide: n.glide != null ? mapNote(n.glide) : undefined,
    })),
  }
}

export function buildRoots(ex: Exercise, range: Range, shift = 0, key: Key = 'auto') {
  const fitted = fitExercise(ex, range)
  const { min, max } = span(fitted)
  if (key !== 'auto') {
    // фиксированная тональность: самая удобная октава в диапазоне, 6 повторов
    const mid = (range.lo + range.hi) / 2 - (min + max) / 2
    let root = key + 12 * Math.round((mid - key) / 12)
    if (shift === 0) {
      if (root + min < range.lo && root + 12 + max <= range.hi) root += 12
      else if (root + max > range.hi && root - 12 + min >= range.lo) root -= 12
    }
    return Array(6).fill(root + shift)
  }
  const loRoot = range.lo + 1 - min
  const hiRoot = range.hi - 1 - max
  const up: number[] = []
  if (loRoot <= hiRoot) {
    if (max - min <= 2 && hiRoot - loRoot > 4) {
      // узкие/однонотные упражнения (messa, twang): ограничиваем лесенку до ≤ 9 кругов равномерным шагом
      for (let i = 0; i < 5; i++) up.push(loRoot + Math.round((i * (hiRoot - loRoot)) / 4) + shift)
    } else {
      for (let root = loRoot; root <= hiRoot; root++) up.push(root + shift)
    }
  } else {
    up.push(Math.round(((range.lo - min) + (range.hi - max)) / 2) + shift)
  }
  return up.concat(up.slice(0, -1).reverse())
}

export class ExerciseRun {
  ex: Exercise
  opts: RunOptions
  roots: number[]
  rep = 0
  /** Сквозной номер прохода (растёт и в режиме повтора) */
  seq = 0
  repeat = false
  targets: Target[] = []
  /** Все цели прогона — для прослушивания записи */
  all: Target[] = []
  results: RepResult[] = []
  phase: Phase = 'idle'
  private repStart = 0
  private listenStart = 0
  private listenEnd = 0
  private singStart = 0
  private singEnd = 0
  private loopHeld = false

  constructor(ex: Exercise, opts: RunOptions) {
    this.ex = fitExercise(ex, opts.range)
    this.opts = opts
    this.roots = buildRoots(this.ex, opts.range, opts.shift, opts.key)
  }

  get beat() { return 60 / (this.ex.bpm * this.opts.tempo) }
  get root() { return this.roots[this.rep] }

  start() {
    const ctx = engine.ensureCtx()
    if (!this.loopHeld) { engine.retainLoop(); this.loopHeld = true }
    this.schedule(ctx.currentTime + 0.4)
    engine.simTarget = t => this.simPitch(t)
  }

  stop() {
    engine.listenOnly = false
    this.phase = 'done'
    engine.stopAll()
    engine.simTarget = null
    if (this.loopHeld) { engine.releaseLoop(); this.loopHeld = false }
  }

  private schedule(t: number) {
    const b = this.beat, root = this.root
    this.repStart = t
    // опорный аккорд тональности
    for (const s of [0, 4, 7]) engine.play(root + s, t, b * 1.6, 45)
    let cur = t + 2 * b
    const place = (sing: boolean, playPiano: boolean, vel: number) => {
      for (const n of this.ex.notes) {
        const len = n.d * b
        if (!n.rest) {
          const t1 = cur + (n.stacc ? len * 0.5 : len)
          const tg = { midi: root + n.s, midiEnd: n.glide != null ? root + n.glide : undefined, t0: cur, t1, syl: n.syl, sing, rep: this.seq }
          this.targets.push(tg); this.all.push(tg)
          if (playPiano) {
            engine.ref(root + n.s, cur, t1 - cur, vel)
            if (n.glide != null) engine.ref(root + n.glide, cur + len * 0.85, len * 0.3, vel - 15)
          }
        }
        cur += len
      }
    }
    const hint = !this.opts.fade || this.rep % 2 === 0
    if (this.opts.mode !== 'together') {
      this.listenStart = cur
      place(false, true, 75)
      this.listenEnd = cur
      if (this.opts.inner) cur += 2 * b // услышь про себя
      cur += b // вдох
      this.singStart = cur
      place(true, this.opts.mode === 'echo' && hint, 50)
    } else {
      this.listenStart = cur
      this.listenEnd = cur
      if (this.opts.inner) { place(false, true, 75); this.listenEnd = cur; cur += 2 * b + b }
      this.singStart = cur
      place(true, hint, 50)
    }
    this.singEnd = cur
    // держим в памяти только текущий и прошлый круг
    this.targets = this.targets.filter(g => g.rep >= this.seq - 1)
  }

  /** Вызывается каждый кадр; возвращает true, если поменялось состояние для интерфейса */
  update(now: number): boolean {
    if (this.phase === 'done' || this.repStart === 0) return false
    const prev = this.phase
    if (now < this.listenStart) this.phase = 'cue'
    else if (now < this.listenEnd) this.phase = 'listen'
    else if (now < this.singStart) this.phase = now < this.singStart - this.beat ? 'inner' : 'breath'
    else this.phase = 'sing'
    engine.listenOnly = this.phase !== 'sing'
    if (now > this.singEnd + 0.3 + engine.latency) {
      this.scoreRep()
      this.climb()
      this.seq++
      if (!this.repeat) this.rep++
      if (this.rep >= this.roots.length) { this.stop(); return true }
      this.schedule(now + 0.3)
      return true
    }
    return prev !== this.phase
  }

  /** Самый быстрый темп, на котором круг спет чисто */
  peak = 0
  /**
   * Лестница темпа: круг спет чисто (от 80%) — следующий на 5% быстрее, не вышло (ниже 60%) — на 5% медленнее.
   * Так учат рифы и быстрые пассажи: точность раньше скорости.
   */
  private climb() {
    if (!this.opts.ladder) return
    const s = this.results.at(-1)?.score ?? 0
    if (s >= 0.8) { this.peak = Math.max(this.peak, this.opts.tempo); this.opts.tempo = Math.min(1.6, +(this.opts.tempo + 0.05).toFixed(2)) }
    else if (s < 0.6) this.opts.tempo = Math.max(0.5, +(this.opts.tempo - 0.05).toFixed(2))
  }
  get tempo() { return this.opts.tempo }

  private scoreRep() {
    const tol = this.opts.tolerance
    const sung = this.targets.filter(g => g.rep === this.seq && g.sing)
    const notes = sung.map(g => {
      const from = g.t0 + 0.2 * (g.t1 - g.t0)
      const frames = engine.history.filter(s => s.t >= from && s.t < g.t1)
      const deltas = frames.filter(s => s.midi != null).map(s => (s.midi! - targetAt(g, s.t)) * 100)
      const hits = deltas.filter(c => Math.abs(c) <= tol).length
      g.score = frames.length ? hits / frames.length : 0
      return { m: g.midi, score: g.score, cents: deltas.length ? median(deltas) : null, voiced: deltas.length }
    })
    const score = notes.length ? notes.reduce((a, n) => a + n.score, 0) / notes.length : 0
    this.results.push({ root: this.root, score, notes })
  }

  // имитация певца для ?sim: немного мимо на некоторых нотах
  private simPitch(t: number) {
    const g = this.targets.find(x => x.sing && t >= x.t0 && t < x.t1)
    if (!g) return null
    const k = this.targets.indexOf(g)
    return targetAt(g, t) + [0.08, -0.32, 0.03, 0.15, -0.55][k % 5]
  }

  summary() {
    const all = this.results.flatMap(r => r.notes)
    const score = all.length ? all.reduce((a, n) => a + n.score, 0) / all.length : 0
    const by = new Map<number, number[]>()
    for (const n of all) if (n.cents != null) by.set(n.m, [...(by.get(n.m) ?? []), n.cents])
    const drift = [...by].map(([m, c]) => ({ m, c: c.reduce((a, x) => a + x, 0) / c.length }))
      .filter(x => Math.abs(x.c) > 15).sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 6)
    return { score, drift, reps: this.results.length, voiced: all.reduce((a, n) => a + n.voiced, 0) }
  }
}
