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
export type Phase = 'idle' | 'cue' | 'listen' | 'breath' | 'sing' | 'done'
export type NoteResult = { m: number; score: number; cents: number | null }
export type RepResult = { root: number; score: number; notes: NoteResult[] }

/** key: 'auto' — тональность идёт по диапазону вверх и вниз; число — фиксированная тональность (0 = до) */
export type Key = 'auto' | number
export type RunOptions = { range: Range; mode: Mode; tempo: number; tolerance: number; shift: number; key?: Key }

/** Высота цели в момент t (с учётом глиссандо) */
export const targetAt = (g: Target, t: number) =>
  g.midiEnd == null ? g.midi : g.midi + (g.midiEnd - g.midi) * Math.min(1, Math.max(0, (t - g.t0) / (g.t1 - g.t0)))

export function buildRoots(ex: Exercise, range: Range, shift = 0, key: Key = 'auto') {
  const { min, max } = span(ex)
  if (key !== 'auto') {
    // фиксированная тональность: самая удобная октава в диапазоне, 6 повторов
    const mid = (range.lo + range.hi) / 2 - (min + max) / 2
    const root = key + 12 * Math.round((mid - key) / 12) + shift
    return Array(6).fill(root)
  }
  const up: number[] = []
  for (let root = range.lo + 1 - min; root + max <= range.hi - 1; root++) up.push(root + shift)
  if (!up.length) up.push(range.lo - min + shift)
  return up.concat(up.slice(0, -1).reverse())
}

export class ExerciseRun {
  ex: Exercise
  opts: RunOptions
  roots: number[]
  rep = 0
  repeat = false
  targets: Target[] = []
  results: RepResult[] = []
  phase: Phase = 'idle'
  private repStart = 0
  private listenStart = 0
  private singStart = 0
  private singEnd = 0

  constructor(ex: Exercise, opts: RunOptions) {
    this.ex = ex
    this.opts = opts
    this.roots = buildRoots(ex, opts.range, opts.shift, opts.key)
  }

  get beat() { return 60 / (this.ex.bpm * this.opts.tempo) }
  get root() { return this.roots[this.rep] }

  start() {
    const ctx = engine.ensureCtx()
    this.schedule(ctx.currentTime + 0.4)
    engine.simTarget = t => this.simPitch(t)
  }

  stop() {
    this.phase = 'done'
    engine.stopAll()
    engine.simTarget = null
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
          this.targets.push({ midi: root + n.s, midiEnd: n.glide != null ? root + n.glide : undefined, t0: cur, t1, syl: n.syl, sing, rep: this.rep })
          if (playPiano) {
            engine.play(root + n.s, cur, t1 - cur, vel)
            if (n.glide != null) engine.play(root + n.glide, cur + len * 0.85, len * 0.3, vel - 15)
          }
        }
        cur += len
      }
    }
    if (this.opts.mode !== 'together') {
      this.listenStart = cur
      place(false, true, 75)
      cur += b // вдох
      this.singStart = cur
      place(true, this.opts.mode === 'echo', 50)
    } else {
      this.listenStart = cur
      this.singStart = cur
      place(true, true, 50)
    }
    this.singEnd = cur
    // держим в памяти только текущий и прошлый круг
    this.targets = this.targets.filter(g => g.rep >= this.rep - 1)
  }

  /** Вызывается каждый кадр; возвращает true, если поменялось состояние для интерфейса */
  update(now: number): boolean {
    if (this.phase === 'done' || this.repStart === 0) return false
    const prev = this.phase
    if (now < this.listenStart) this.phase = 'cue'
    else if (now < this.singStart) this.phase = now < this.singStart - this.beat ? 'listen' : 'breath'
    else this.phase = 'sing'
    if (now > this.singEnd + 0.3) {
      this.scoreRep()
      if (!this.repeat) this.rep++
      if (this.rep >= this.roots.length) { this.stop(); return true }
      this.schedule(now + 0.3)
      return true
    }
    return prev !== this.phase
  }

  private scoreRep() {
    const tol = this.opts.tolerance
    const sung = this.targets.filter(g => g.rep === this.rep && g.sing)
    const notes = sung.map(g => {
      const from = g.t0 + 0.2 * (g.t1 - g.t0)
      const frames = engine.history.filter(s => s.t >= from && s.t < g.t1)
      const cents = frames.filter(s => s.midi != null).map(s => (s.midi! - targetAt(g, s.t)) * 100)
      const hits = cents.filter(c => Math.abs(c) <= tol).length
      g.score = frames.length ? hits / frames.length : 0
      return { m: g.midi, score: g.score, cents: cents.length ? median(cents) : null }
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
    return { score, drift, reps: this.results.length }
  }
}
