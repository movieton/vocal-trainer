import { useEffect, useRef, useState } from 'react'
import PianoRoll from '../components/PianoRoll'
import { LiveNote, MicGate, useEngine } from '../components/Mic'
import { engine, SIM } from '../lib/audio'
import { noteName } from '../lib/music'
import { logSession, useStored, useWorkRange } from '../lib/store'
import type { Target } from '../lib/run'

const TOL = 15

/** Длинная нота: держишь выбранную ноту до конца выдоха, меряем время и стабильность */
export default function LongNote() {
  useEngine(8)
  const r = useWorkRange()
  const [note, setNote] = useState(Math.round((r.lo + r.hi) / 2) - 2)
  const [best, setBest] = useStored<Record<string, number>>('breathBest', {})
  const [res, setRes] = useState<{ sec: number; stable: number } | null>(null)
  const st = useRef<{ phase: 'idle' | 'wait' | 'sing'; t0: number; frames: number; good: number; silence: number }>({ phase: 'idle', t0: 0, frames: 0, good: 0, silence: 0 })
  const target = useRef<Target | null>(null)

  useEffect(() => engine.subscribe(() => {
    const s = st.current, now = engine.now(), m = engine.current
    if (s.phase === 'wait' && m != null && Math.abs(m - note) < 1) { s.phase = 'sing'; s.t0 = now }
    if (s.phase !== 'sing') return
    if (target.current) target.current.t1 = now + 3
    if (m == null) {
      s.silence++
      // полсекунды тишины — нота закончилась
      if (s.silence > 30) finish()
      return
    }
    s.silence = 0; s.frames++
    if (Math.abs(m - note) * 100 <= TOL) s.good++
  }))

  useEffect(() => {
    if (!SIM) return
    engine.simTarget = t => {
      const s = st.current
      if (s.phase === 'idle') return null
      const el = s.phase === 'sing' ? t - s.t0 : 0
      return el > 9 ? null : note - 0.002 * el * el + 0.03 * Math.sin(t * 6)
    }
    return () => { engine.simTarget = null }
  }, [note])

  const start = () => {
    const now = engine.ensureCtx().currentTime
    engine.play(note, now, 1.2, 70)
    target.current = { midi: note, t0: now + 1.2, t1: now + 4, sing: true, rep: 0 }
    st.current = { phase: 'wait', t0: 0, frames: 0, good: 0, silence: 0 }
    setRes(null)
  }
  function finish() {
    const s = st.current
    const sec = engine.now() - s.t0 - 0.5
    const stable = s.frames ? s.good / s.frames : 0
    s.phase = 'idle'
    setRes({ sec, stable })
    if (sec > (best['long-note'] ?? 0)) setBest({ ...best, 'long-note': sec })
    logSession({ date: Date.now(), kind: 'breath', id: 'long-note', title: 'Длинная нота', score: Math.round(stable * 100) })
  }

  const phase = st.current.phase
  return (
    <>
      <MicGate />
      <div className="toolbar">
        <span className="stepper">
          <button onClick={() => setNote(note - 1)} disabled={phase !== 'idle'} aria-label="Ниже">−</button>
          <span>{noteName(note)}</span>
          <button onClick={() => setNote(note + 1)} disabled={phase !== 'idle'} aria-label="Выше">+</button>
        </span>
        <button className={'btn' + (phase !== 'idle' ? ' stop' : '')} disabled={engine.mic !== 'on'}
          onClick={phase === 'idle' ? start : finish}>{phase === 'idle' ? 'Начать' : phase === 'wait' ? 'Пой ноту…' : 'Стоп'}</button>
        <span className="status">
          {phase === 'sing' && <span>Держишь <b>{(engine.now() - st.current.t0).toFixed(1)} с</b></span>}
          <span>Рекорд <b>{best['long-note'] ? best['long-note'].toFixed(1) + ' с' : '—'}</b></span>
        </span>
        <LiveNote />
      </div>
      <PianoRoll view={() => ({ lo: note - 5, hi: note + 5 })} targets={() => (target.current ? [target.current] : [])} tolerance={TOL} windowSec={10} playhead={0.7} />
      {res && (
        <div className="card result">
          <h2>{res.sec.toFixed(1)} с · стабильность {Math.round(res.stable * 100)}%</h2>
          <p className="muted">Стабильность — доля времени в пределах ±{TOL} центов от ноты. {res.stable < 0.6 ? 'Нота гуляет: попробуй тише и ровнее, с опорой на выдохе.' : 'Хорошая ровная нота.'}</p>
        </div>
      )}
    </>
  )
}
